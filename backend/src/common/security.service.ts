import {
  Injectable,
  HttpException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DatabaseService, SqlClient } from "./database.service";
import { CryptoService } from "./crypto.service";
@Injectable()
export class SecurityService {
  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: CryptoService,
  ) {}
  async limit(key: string, max: number, seconds: number) {
    const r = await this.db.query(
      `INSERT INTO rate_limit_buckets(key,count,expires_at) VALUES($1,1,now()+$2*interval '1 second') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limit_buckets.expires_at<=now() THEN 1 ELSE rate_limit_buckets.count+1 END, expires_at=CASE WHEN rate_limit_buckets.expires_at<=now() THEN now()+$2*interval '1 second' ELSE rate_limit_buckets.expires_at END RETURNING count`,
      [this.crypto.digest(key, "rate-limit"), seconds],
    );
    if (r.rows[0]!.count > max)
      throw new HttpException("Please try again later", 429);
  }
  async audit(
    tx: SqlClient,
    userId: string,
    action: string,
    entityId: string,
    changes: Record<string, unknown> = {},
  ) {
    await tx.query(
      "INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        "user",
        userId,
        action,
        action.split(".")[0],
        entityId,
        randomUUID(),
        JSON.stringify(changes),
      ],
    );
  }
  async idempotent<T>(
    userId: string,
    scope: string,
    key: string | undefined,
    body: unknown,
    fn: (tx: SqlClient) => Promise<T>,
  ): Promise<T> {
    if (!key || !/^[A-Za-z0-9_-]{16,128}$/.test(key))
      throw new BadRequestException("A valid Idempotency-Key is required");
    return this.db.transaction(async (tx) => {
      await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId]);
      const hash = this.crypto.digest(JSON.stringify(body), "idempotency");
      const context = `idempotency:${userId}:${scope}:${key}`;
      const old = (
        await tx.query(
          "SELECT * FROM idempotency_keys WHERE actor_id=$1 AND scope=$2 AND key=$3",
          [userId, scope, key],
        )
      ).rows[0];
      if (old) {
        if (old.request_hash !== hash)
          throw new ConflictException(
            "Idempotency key already used for different input",
          );
        if (old.status === "completed")
          return JSON.parse(
            this.crypto.decrypt(old.response_ciphertext, context),
          ) as T;
        throw new ConflictException("Request in progress");
      }
      await tx.query(
        "INSERT INTO idempotency_keys(actor_id,scope,key,request_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 day')",
        [userId, scope, key, hash],
      );
      const result = await fn(tx);
      await tx.query(
        "UPDATE idempotency_keys SET status='completed',response_status=201,response_ciphertext=$4 WHERE actor_id=$1 AND scope=$2 AND key=$3",
        [
          userId,
          scope,
          key,
          this.crypto.encrypt(JSON.stringify(result), context),
        ],
      );
      return result;
    });
  }
}

import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "../../common/database.service";
import { SecurityService } from "../../common/security.service";
import {
  VerificationProvider,
  VerificationType,
} from "./verification.provider";
@Injectable()
export class VerificationService {
  readonly required: VerificationType[] = [
    "identity",
    "pan",
    "document",
    "selfie",
    "risk",
  ];
  constructor(
    private readonly db: DatabaseService,
    private readonly security: SecurityService,
    private readonly provider: VerificationProvider,
  ) {}
  async status(uid: string) {
    if (process.env.IDENTITY_VERIFICATION_ENABLED === "false") throw new NotFoundException();
    const u = (
      await this.db.query("SELECT verification_status FROM users WHERE id=$1", [
        uid,
      ])
    ).rows[0]!;
    const records = (
      await this.db.query(
        'SELECT id,type,provider,provider_ref AS "providerReference",upper(status::text) AS status,submitted_at AS "submittedAt",reviewed_at AS "reviewedAt",rejection_reason AS "rejectionReason",metadata FROM verification_records WHERE user_id=$1 ORDER BY submitted_at DESC',
        [uid],
      )
    ).rows;
    return {
      status: u.verification_status.toUpperCase(),
      requiredTypes: this.required,
      records,
    };
  }
  async start(uid: string, key: string | undefined) {
    if (process.env.IDENTITY_VERIFICATION_ENABLED === "false") throw new NotFoundException();
    await this.security.limit("verification:" + uid, 10, 3600);
    return this.security.idempotent(
      uid,
      "verification.start",
      key,
      {},
      async (tx) => {
        const current = (
          await tx.query("SELECT verification_status FROM users WHERE id=$1", [
            uid,
          ])
        ).rows[0];
        if (current?.verification_status === "verified")
          throw new BadRequestException("Account already verified");
        const existing = (
          await tx.query(
            "SELECT id,type,provider_ref AS \"providerReference\",upper(status::text) AS status FROM verification_records WHERE user_id=$1 AND type<>'bank' AND status IN ('pending','under_review')",
            [uid],
          )
        ).rows;
        if (existing.length)
          return {
            records: existing,
            sandbox: process.env.VERIFICATION_PROVIDER === "mock",
          };
        const records = [];
        for (const type of this.required) {
          const p = await this.provider.start(uid, type);
          const row = (
            await tx.query(
              "INSERT INTO verification_records(user_id,type,provider,provider_ref,status,metadata) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,type,upper(status::text) AS status",
              [
                uid,
                type,
                p.provider,
                p.reference,
                p.status,
                JSON.stringify({ sandbox: p.sandbox }),
              ],
            )
          ).rows[0];
          records.push(row);
        }
        await tx.query(
          "UPDATE users SET verification_status='pending',updated_at=now() WHERE id=$1",
          [uid],
        );
        await this.security.audit(tx, uid, "verification.started", uid);
        return {
          records,
          sandbox: process.env.VERIFICATION_PROVIDER === "mock",
        };
      },
    );
  }
  async submit(uid: string, id: string, key: string | undefined) {
    if (process.env.IDENTITY_VERIFICATION_ENABLED === "false") throw new NotFoundException();
    return this.security.idempotent(
      uid,
      "verification.submit",
      key,
      { id },
      async (tx) => {
        const row = (
          await tx.query(
            "SELECT * FROM verification_records WHERE id=$1 AND user_id=$2 FOR UPDATE",
            [id, uid],
          )
        ).rows[0];
        if (!row) throw new NotFoundException();
        if (!["pending", "under_review"].includes(row.status))
          throw new BadRequestException("Review already completed");
        const p = await this.provider.submit(row.provider_ref, row.type);
        await tx.query(
          "UPDATE verification_records SET status=$2::verification_status,reviewed_at=CASE WHEN $2::text IN ('verified','rejected') THEN now() ELSE NULL END,rejection_reason=$3 WHERE id=$1",
          [id, p.status, p.reason ?? null],
        );
        const latest = (
          await tx.query(
            "SELECT DISTINCT ON(type) type,status FROM verification_records WHERE user_id=$1 AND type<>'bank' ORDER BY type,submitted_at DESC",
            [uid],
          )
        ).rows;
        const status = latest.some((r) => r.status === "rejected")
          ? "rejected"
          : this.required.every((t) =>
                latest.some((r) => r.type === t && r.status === "verified"),
              )
            ? "verified"
            : "under_review";
        await tx.query(
          "UPDATE users SET verification_status=$2,updated_at=now() WHERE id=$1",
          [uid, status],
        );
        await this.security.audit(tx, uid, "verification.submitted", id, {
          status: p.status,
          sandbox: p.sandbox,
        });
        return {
          id,
          status: p.status.toUpperCase(),
          accountVerificationStatus: status.toUpperCase(),
          sandbox: p.sandbox,
        };
      },
    );
  }
}

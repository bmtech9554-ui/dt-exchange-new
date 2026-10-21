import { syntheticValidation, SYNTHETIC_BANK_PROVIDER } from '../../common/synthetic-validation';
import { privateBetaEnabled, requirePrivateBetaAccount } from '../../common/private-beta';
import { selfDeclaredManualBanks } from '../../config/manual-mode';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { IsString, Length, Matches, IsOptional } from "class-validator";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../../common/database.service";
import { CryptoService } from "../../common/crypto.service";
import { SecurityService } from "../../common/security.service";
import { VerificationProvider } from "../verification/verification.provider";
export class BankDto {
  @IsString()
  @Length(2, 100)
  @Matches(/^[^\x00-\x1f<>]+$/)
  accountHolderName!: string;
  @Matches(/^[0-9]{9,18}$/) accountNumber!: string;
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/) ifsc!: string;
  @IsString() @Length(2, 100) @Matches(/^[^\x00-\x1f<>]+$/) bankName!: string;
  @IsOptional() @IsString() @Length(1, 100) branch?: string;
}
@Injectable()
export class BanksService {
  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: CryptoService,
    private readonly security: SecurityService,
    private readonly provider: VerificationProvider,
  ) {}
  private view(b: Record<string, any>) {
    return {
      id: b.id,
      accountHolderName: this.crypto.decrypt(
        b.holder_name_ciphertext,
        b.id + ":holder",
      ),
      accountNumber: "XXXXXX" + b.last_four,
      ifsc: b.ifsc,
      bankName: b.bank_name,
      branch: b.branch,
      verificationStatus: b.verification_status.toUpperCase(),
      available: !b.disabled_at && (b.verification_status === 'verified' || (b.self_declared === true && selfDeclaredManualBanks())),
      independentlyVerified: b.verification_status === 'verified',
      accountStatus: b.disabled_at ? 'DISABLED' : b.self_declared && selfDeclaredManualBanks() ? 'AVAILABLE' : b.verification_status.toUpperCase(),
      isDefault: b.is_default,
      createdAt: b.created_at,
    };
  }
  async list(uid: string) {
    return (
      await this.db.query(
        "SELECT * FROM bank_accounts WHERE user_id=$1 AND disabled_at IS NULL ORDER BY is_default DESC,created_at",
        [uid],
      )
    ).rows.map((b) => this.view(b));
  }
  async get(uid: string, id: string) {
    const b = (
      await this.db.query(
        "SELECT * FROM bank_accounts WHERE id=$1 AND user_id=$2 AND disabled_at IS NULL",
        [id, uid],
      )
    ).rows[0];
    if (!b) throw new NotFoundException();
    return this.view(b);
  }
  async add(uid: string, dto: BankDto, key?: string) {
    await this.security.limit("bank-add:" + uid, 10, 3600);
    return this.security.idempotent(uid, "bank.add", key, dto, async (tx) => {
      await requirePrivateBetaAccount(tx, uid);
      const owner=(await tx.query('SELECT status FROM users WHERE id=$1 FOR UPDATE',[uid])).rows[0];
      if(owner?.status!=='active') throw new BadRequestException('Active account required');
      const fingerprint = this.crypto.digest(
        dto.accountNumber + ":" + dto.ifsc,
        "bank",
      );
      if (
        (
          await tx.query(
            "SELECT id FROM bank_accounts WHERE user_id=$1 AND account_fingerprint=$2",
            [uid, fingerprint],
          )
        ).rows.length
      )
        throw new ConflictException("Bank account already added");
      const count = (
        await tx.query(
          "SELECT count(*)::int AS n FROM bank_accounts WHERE user_id=$1 AND disabled_at IS NULL",
          [uid],
        )
      ).rows[0]!.n;
      if (count >= 5)
        throw new BadRequestException("Maximum bank accounts reached");
      const synthetic = dto.ifsc==='TEST0000000' && dto.accountNumber==='000000000000' && dto.bankName==='TEST SYNTHETIC NON-PAYOUT' && dto.accountHolderName==='TEST SYNTHETIC' && await syntheticValidation(tx,uid);
      if (privateBetaEnabled() && !synthetic) throw new BadRequestException('Test bank fixture unavailable');
      if (dto.ifsc.startsWith('TEST') && !synthetic) throw new BadRequestException('Test bank fixture unavailable');
      const selfDeclared = !synthetic && selfDeclaredManualBanks();
      const result = synthetic ? {provider:SYNTHETIC_BANK_PROVIDER,reference:randomUUID(),status:'under_review' as const,sandbox:true} : selfDeclared ? {provider:'self-declared',reference:randomUUID(),status:'not_started' as const,sandbox:false} : await this.provider.bank(uid, dto.accountNumber, dto.ifsc),
        id = randomUUID();
      const verification = (
        await tx.query(
          "INSERT INTO verification_records(user_id,type,provider,provider_ref,status,reviewed_at,metadata) VALUES($1,'bank',$2,$3,$4::verification_status,CASE WHEN $4::verification_status::text IN ('verified','rejected') THEN now() ELSE NULL END,$5) RETURNING id",
          [
            uid,
            result.provider,
            result.reference,
            result.status,
            JSON.stringify({ sandbox: result.sandbox, ...(synthetic?{synthetic:true,nonPayable:true}:{}) }),
          ],
        )
      ).rows[0]!;
      const isDefault =
        (result.status === "verified" || selfDeclared) &&
        !(
          await tx.query(
            "SELECT id FROM bank_accounts WHERE user_id=$1 AND is_default",
            [uid],
          )
        ).rows.length;
      const row = (
        await tx.query(
          "INSERT INTO bank_accounts(id,user_id,holder_name_ciphertext,account_number_ciphertext,account_fingerprint,last_four,ifsc,bank_name,branch,verification_status,is_default,verification_record_id,self_declared) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *",
          [
            id,
            uid,
            this.crypto.encrypt(dto.accountHolderName.trim(), id + ":holder"),
            this.crypto.encrypt(dto.accountNumber, id + ":number"),
            fingerprint,
            dto.accountNumber.slice(-4),
            dto.ifsc,
            dto.bankName.trim(),
            dto.branch ?? null,
            result.status,
            isDefault,
            verification.id,
            selfDeclared,
          ],
        )
      ).rows[0]!;
      await this.security.audit(tx, uid, "bank.added", id, {
        lastFour: dto.accountNumber.slice(-4),
        sandbox: result.sandbox,
        selfDeclared,
      });
      return this.view(row);
    });
  }
  async modify(uid: string, id: string, remove = false) {
    return this.db.transaction(async (tx) => {
      await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [uid]);
      const b = (
        await tx.query(
          "SELECT * FROM bank_accounts WHERE id=$1 AND user_id=$2 AND disabled_at IS NULL",
          [id, uid],
        )
      ).rows[0];
      if (!b) throw new NotFoundException();
      if (remove) {
        await tx.query(
          "UPDATE bank_accounts SET disabled_at=now(),is_default=false,updated_at=now() WHERE id=$1",
          [id],
        );
        if (b.is_default)
          await tx.query(
            "UPDATE bank_accounts SET is_default=true WHERE id=(SELECT id FROM bank_accounts WHERE user_id=$1 AND disabled_at IS NULL AND (verification_status='verified' OR self_declared) ORDER BY created_at LIMIT 1)",
            [uid],
          );
      } else {
        if (b.verification_status !== "verified" && !b.self_declared)
          throw new BadRequestException("Bank account unavailable");
        await tx.query(
          "UPDATE bank_accounts SET is_default=false WHERE user_id=$1 AND is_default",
          [uid],
        );
        await tx.query(
          "UPDATE bank_accounts SET is_default=true,updated_at=now() WHERE id=$1",
          [id],
        );
      }
      await this.security.audit(
        tx,
        uid,
        remove ? "bank.disabled" : "bank.default",
        id,
      );
      return { success: true };
    });
  }
}

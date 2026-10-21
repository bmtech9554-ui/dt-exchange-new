import { syntheticValidation, SYNTHETIC_BANK_PROVIDER } from '../../common/synthetic-validation';
import { privateBetaEnabled, requirePrivateBetaAccount } from '../../common/private-beta';
import { manualDeposits, selfDeclaredManualBanks } from '../../config/manual-mode';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { IsOptional, IsUUID, Matches, IsIn } from "class-validator";
import { DatabaseService } from "../../common/database.service";
import { SecurityService } from "../../common/security.service";
import { RatesService } from "../rates/rates.service";
import { calculateFee, decimal, format } from "../rates/money";
import { LimitsService } from "./limits.service";
export class QuoteDto {
  @IsOptional() @IsIn(["onchain", "wallet"]) fundingSource?:
    | "onchain"
    | "wallet";
  @Matches(/^\d{1,12}(\.\d{1,6})?$/) amountUsdt!: string;
  @IsOptional() @IsUUID() bankAccountId?: string;
}
@Injectable()
export class QuotesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly security: SecurityService,
    private readonly rates: RatesService,
    private readonly limits: LimitsService,
  ) {}
  private view(q: Record<string, any>) {
    return {
      quoteId: q.id,
      amountUsdt: q.amount_usdt,
      marketRate: q.market_rate,
      exchangeRate: q.rate_inr,
      feeInrMinor: String(q.fee_inr_minor),
      finalInrMinor: String(q.net_inr_minor),
      finalInr: format(BigInt(q.net_inr_minor), 2),
      fee: format(BigInt(q.fee_inr_minor), 2),
      bankAccountId: q.bank_account_id,
      createdAt: q.created_at,
      expiresAt: q.expires_at,
      status:
        q.status === "ACTIVE" && new Date(q.expires_at) <= new Date()
          ? "EXPIRED"
          : q.status,
      executionEnabled: process.env.TRANSACTIONS_ENABLED === "true",
      fundingSource: q.funding_source,
    };
  }
  async create(uid: string, dto: QuoteDto, key?: string) {
    await this.security.limit("quotes:" + uid, 30, 60);
    return this.security.idempotent(uid, "sell.quote", key, dto, async (tx) => {
      await requirePrivateBetaAccount(tx, uid);
      const amount = decimal(dto.amountUsdt, 6);
      const policy = await this.rates.policy(tx);
      await this.limits.enforce(tx, uid, amount, policy);
      let bank = (
        await tx.query(
          `SELECT id FROM bank_accounts WHERE user_id=$1 AND disabled_at IS NULL AND (verification_status='verified' ${selfDeclaredManualBanks()? 'OR self_declared' : ''}) ${dto.bankAccountId ? "AND id=$2" : "AND is_default"}`,
          dto.bankAccountId ? [uid, dto.bankAccountId] : [uid],
        )
      ).rows[0];
      if (privateBetaEnabled()) bank = undefined;
      if (!bank && dto.bankAccountId && await syntheticValidation(tx,uid)) {
        bank=(await tx.query("SELECT b.id FROM bank_accounts b JOIN verification_records v ON v.id=b.verification_record_id WHERE b.user_id=$1 AND b.id=$2 AND b.disabled_at IS NULL AND b.verification_status='under_review' AND v.provider=$3 AND v.metadata->>'nonPayable'='true'",[uid,dto.bankAccountId,SYNTHETIC_BANK_PROVIDER])).rows[0];
      }
      if (!bank)
        throw new BadRequestException("Select an available bank account");
      const rate = await this.rates.snapshot(tx);
      const gross = (amount * decimal(rate.exchangeRate, 8)) / 1000000000000n,
        fee = calculateFee(
          gross,
          BigInt(rate.policy.flat_inr_minor),
          rate.policy.basis_points,
        );
      if (gross <= fee)
        throw new BadRequestException("Amount does not cover fees");
      const q = (
        await tx.query(
          "INSERT INTO quotes(user_id,bank_account_id,funding_source,amount_usdt,rate_inr,gross_inr_minor,fee_inr_minor,net_inr_minor,exchange_rate_id,fee_id,rate_policy_id,expires_at) VALUES($1,$2,$12,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *",
          [
            uid,
            bank.id,
            format(amount, 6),
            rate.exchangeRate,
            gross.toString(),
            fee.toString(),
            (gross - fee).toString(),
            rate.id,
            rate.policy.fee_id,
            rate.policy.id,
            rate.validUntil,
            manualDeposits() ? "wallet" : (dto.fundingSource ?? "onchain"),
          ],
        )
      ).rows[0]!;
      await this.security.audit(tx, uid, "quote.created", q.id, {
        policyId: rate.policy.id,
      });
      return {
        ...this.view({ ...q, status: "ACTIVE", market_rate: rate.marketRate }),
        fixedFeeInrMinor: rate.fixedFeeInrMinor,
        feeBasisPoints: rate.feeBasisPoints,
        spreadBps: rate.spreadBps,
        sandbox: rate.sandbox,
      };
    });
  }
  async get(uid: string, id: string) {
    const q = (
      await this.db.query(
        "SELECT q.*,s.status,r.market_rate FROM quotes q JOIN quote_states s ON s.quote_id=q.id JOIN exchange_rates r ON r.id=q.exchange_rate_id WHERE q.id=$1 AND q.user_id=$2",
        [id, uid],
      )
    ).rows[0];
    if (!q) throw new NotFoundException();
    return this.view(q);
  }
  async cancel(uid: string, id: string) {
    return this.db.transaction(async (tx) => {
      await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [uid]);
      const q = (
        await tx.query(
          "UPDATE quote_states s SET status='CANCELLED' FROM quotes q WHERE s.quote_id=q.id AND q.id=$1 AND q.user_id=$2 AND s.status='ACTIVE' RETURNING s.quote_id",
          [id, uid],
        )
      ).rows[0];
      if (!q) throw new BadRequestException("Quote unavailable");
      await this.security.audit(tx, uid, "quote.cancelled", id);
      return { success: true };
    });
  }
}

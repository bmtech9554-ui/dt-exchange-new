import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { DatabaseService } from "../../common/database.service";
export class PayoutTransientError extends Error {
  constructor(readonly notAccepted: boolean) {
    super("TRANSIENT_PROVIDER_UNAVAILABLE");
  }
}
export type Rail = "IMPS" | "NEFT" | "RTGS";
export type ProviderResult = {
  requestKey: string;
  reference: string;
  amountMinor: string;
  status: "PROCESSING" | "SUCCESS" | "FAILED" | "REVERSED";
  utr?: string;
  failureCode?: string;
  definitiveFailure?: boolean;
  reversalReference?: string;
};
export type Beneficiary = {
  holder: string;
  accountNumber: string;
  maskedAccount: string;
  ifsc: string;
  bank: string;
  bankId: string;
};
export abstract class PayoutProvider {
  abstract readonly name: string;
  abstract readonly sandbox: boolean;
  abstract readonly capabilities: {
    rails: Rail[];
    idempotency: boolean;
    minMinor: bigint;
    maxMinor: bigint;
  };
  abstract createPayout(input: {
    requestKey: string;
    amountMinor: string;
    rail: Rail;
    beneficiary: Beneficiary;
  }): Promise<ProviderResult>;
  abstract getPayoutStatus(requestKey: string): Promise<ProviderResult | null>;
  abstract verifyWebhook(
    raw: Buffer,
    timestamp: string,
    signature: string,
  ): void;
  abstract parseWebhook(raw: Buffer): {
    eventId: string;
    result: ProviderResult;
  };
  getBalance?(): Promise<{ amountMinor: string; at: string }>;
  cancelPayout?(requestKey: string): Promise<ProviderResult>;
  getBeneficiaryStatus?(
    beneficiary: Beneficiary,
  ): Promise<"VERIFIED" | "REVIEW">;
  listPayouts?(): Promise<ProviderResult[]>;
}
export function payoutConfig() {
  const integer = (name: string, fallback: string, min = 0) => {
    const s = process.env[name] ?? fallback;
    if (!/^\d{1,15}$/.test(s) || Number(s) < min)
      throw new Error("INVALID_" + name);
    return Number(s);
  };
  const provider = process.env.PAYOUT_PROVIDER ?? "mock";
  return {
    enabled: process.env.PAYOUTS_ENABLED === "true",
    provider,
    min: BigInt(integer("PAYOUT_MIN_AMOUNT", "100")),
    max: BigInt(integer("PAYOUT_MAX_AMOUNT", "10000000", 1)),
    daily: BigInt(integer("PAYOUT_DAILY_LIMIT", "100000000", 1)),
    poll: integer("PAYOUT_STATUS_POLL_INTERVAL", "30000", 5000),
    retries: integer("PAYOUT_MAX_RETRIES", "3"),
    retryDelay: integer("PAYOUT_RETRY_DELAY", "5000", 1000),
    bankAge: integer("PAYOUT_BANK_COOLDOWN_SECONDS", "86400"),
    failedLimit: integer("PAYOUT_FAILED_ATTEMPT_LIMIT", "3", 1),
    stale: integer("PAYOUT_STALE_SECONDS", "3600", 60),
  };
}
export function validateResult(value: unknown): ProviderResult {
  const r = value as ProviderResult;
  if (
    !r ||
    typeof r.amountMinor !== "string" ||
    !/^\d{1,16}$/.test(r.amountMinor) ||
    !["PROCESSING", "SUCCESS", "FAILED", "REVERSED"].includes(r.status) ||
    typeof r.requestKey !== "string" ||
    !/^[\w:-]{1,150}$/.test(r.requestKey) ||
    typeof r.reference !== "string" ||
    !/^[\w-]{1,120}$/.test(r.reference) ||
    (r.status === "SUCCESS" && (!r.utr || !/^[\w-]{1,100}$/.test(r.utr)))
  )
    throw new BadRequestException("Invalid provider response");
  if (
    (r.definitiveFailure !== undefined &&
      typeof r.definitiveFailure !== "boolean") ||
    (r.utr !== undefined &&
      (typeof r.utr !== "string" || !/^[\w-]{1,100}$/.test(r.utr))) ||
    (r.reversalReference !== undefined &&
      (typeof r.reversalReference !== "string" ||
        !/^[\w-]{1,120}$/.test(r.reversalReference))) ||
    (r.failureCode !== undefined &&
      (typeof r.failureCode !== "string" ||
        !/^[A-Z0-9_]{1,80}$/.test(r.failureCode)))
  )
    throw new BadRequestException("Invalid provider code");
  return r;
}
@Injectable()
export class MockPayoutProvider extends PayoutProvider {
  readonly name = "mock";
  readonly sandbox = true;
  readonly capabilities = {
    rails: ["IMPS", "NEFT", "RTGS"] as Rail[],
    idempotency: true,
    minMinor: 1n,
    maxMinor: 10000000000n,
  };
  constructor(private readonly db: DatabaseService) {
    super();
  }
  private guard() {
    if (process.env.NODE_ENV === "production")
      throw new ServiceUnavailableException();
  }
  async createPayout(i: {
    requestKey: string;
    amountMinor: string;
    rail: Rail;
    beneficiary: Beneficiary;
  }) {
    this.guard();
    // Durable sandbox: submission NEVER generates success, UTR or a real bank transfer.
    const ref =
      "SANDBOX-" +
      createHash("sha256")
        .update("sandbox-payout:" + i.requestKey)
        .digest("hex")
        .slice(0, 24);
    await this.db.query(
      "INSERT INTO sandbox_payout_records(request_key,provider_ref,amount_inr_minor) VALUES($1,$2,$3) ON CONFLICT(request_key) DO NOTHING",
      [i.requestKey, ref, i.amountMinor],
    );
    const r = (await this.getPayoutStatus(i.requestKey))!;
    if (r.amountMinor !== i.amountMinor)
      throw new BadRequestException("Sandbox idempotency conflict");
    return r;
  }
  async getPayoutStatus(key: string) {
    this.guard();
    const r = (
      await this.db.query(
        "SELECT * FROM sandbox_payout_records WHERE request_key=$1",
        [key],
      )
    ).rows[0];
    return r
      ? validateResult({
          requestKey: key,
          reference: r.provider_ref,
          amountMinor: String(r.amount_inr_minor),
          status: r.status,
          utr: r.utr ?? undefined,
          failureCode: r.failure_code ?? undefined,
          definitiveFailure: r.status === "FAILED",
          reversalReference:
            r.status === "REVERSED" ? r.provider_ref : undefined,
        })
      : null;
  }
  async listPayouts() {
    this.guard();
    const rows = (
      await this.db.query("SELECT request_key FROM sandbox_payout_records")
    ).rows;
    return Promise.all(
      rows.map(async (r) => (await this.getPayoutStatus(r.request_key))!),
    );
  }
  verifyWebhook(raw: Buffer, timestamp: string, signature: string) {
    this.guard();
    const secret = process.env.PAYOUT_WEBHOOK_SECRET;
    if (!secret || secret.length < 32) throw new ServiceUnavailableException();
    if (
      !/^\d{10}$/.test(timestamp) ||
      Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
      !/^[a-f0-9]{64}$/.test(signature)
    )
      throw new UnauthorizedException();
    const expected = createHmac("sha256", secret)
      .update(timestamp + ".")
      .update(raw)
      .digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, "hex")))
      throw new UnauthorizedException();
  }
  parseWebhook(raw: Buffer) {
    let body: any;
    try {
      body = JSON.parse(raw.toString("utf8"));
    } catch {
      throw new BadRequestException();
    }
    if (!body || !/^[\w-]{1,120}$/.test(body.eventId))
      throw new BadRequestException();
    return { eventId: body.eventId, result: validateResult(body.result) };
  }
}

/** Explicit non-executing adapter. Manual payments are recorded by ManualService. */
export class ManualPayoutProvider extends PayoutProvider {
 readonly name='manual';readonly sandbox=false;readonly capabilities={rails:[] as Rail[],idempotency:false,minMinor:0n,maxMinor:0n};
 async createPayout():Promise<ProviderResult>{throw new ServiceUnavailableException('Automatic payout disabled');}
 async getPayoutStatus():Promise<ProviderResult|null>{throw new ServiceUnavailableException('Manual payment has no provider status');}
 verifyWebhook():never{throw new UnauthorizedException('Manual payments do not accept provider webhooks');}
 parseWebhook():never{throw new BadRequestException();}
}

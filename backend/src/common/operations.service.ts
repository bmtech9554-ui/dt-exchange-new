import { CryptoService } from "./crypto.service";
import {
  Injectable,
  Controller,
  Get,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DatabaseService } from "./database.service";
import { Public } from "./auth.guard";
const flags = [
  "registrations",
  "deposits",
  "sell",
  "payouts",
  "referrals",
  "notifications",
  "support",
];
const permissions: Record<string, string> = {
  dashboard: "dashboard.read",
  users: "users.read",
  verification: "verification.read",
  banks: "banks.read",
  wallets: "wallets.read",
  audit: "audit.read",
  settings: "settings.read",
  providers: "providers.read",
  health: "system.monitor",
  queues: "system.monitor",
  ledger: "wallets.read",
  rates: "settings.read",
  fees: "settings.read",
  limits: "settings.read",
};
export function validateControls(input: any) {
  if (
    !input ||
    !["NORMAL", "READ_ONLY", "MAINTENANCE"].includes(input.mode) ||
    flags.some((k) => typeof input[k] !== "boolean") ||
    Object.keys(input).some((k) => !["mode", ...flags].includes(k))
  )
    throw new BadRequestException("Invalid controls");
  return {
    mode: input.mode,
    ...Object.fromEntries(flags.map((k) => [k, input[k]])),
  };
}
export function providerReadiness() {
  return Object.entries({
    blockchain: "TRON_PROVIDER",
    payout: "PAYOUT_PROVIDER",
    email: "EMAIL_PROVIDER",
    sms: "SMS_PROVIDER",
    push: "PUSH_PROVIDER",
    verification: "VERIFICATION_PROVIDER",
    market: "RATE_PROVIDER",
    otp: "OTP_PROVIDER",
    storage: "SUPPORT_STORAGE_PROVIDER",
  }).map(([provider, key]) => {
    const selected = process.env[key] ?? "mock";
    return {
      provider,
      mode: /mock|dev/i.test(selected) ? "MOCK" : "NOT_VALIDATED",
      adapter:
        provider === "blockchain" && selected === "tron-http"
          ? "tron-http"
          : /mock|dev/i.test(selected)
            ? "development"
            : "unregistered",
      connectivity: "NOT_VALIDATED",
    };
  });
}
@Injectable()
export class OperationsService {
  constructor(private readonly db: DatabaseService, private readonly crypto: CryptoService) {}
  async permission(actor: string, permission: string) {
    if (
      !(
        await this.db.query(
          "SELECT 1 FROM admin_user_roles r JOIN admin_role_permissions p ON p.role_id=r.role_id WHERE r.admin_user_id=$1 AND p.permission_code=$2",
          [actor, permission],
        )
      ).rows.length
    )
      throw new ForbiddenException();
  }
  async status() {
    const row = (
      await this.db.query(
        "SELECT value,version FROM system_settings WHERE key='operational_controls'",
      )
    ).rows[0];
    if (!row) throw new Error("OPERATIONS_UNMIGRATED");
    return {
      ...row.value,
      version: row.version,
      message:
        row.value.mode === "NORMAL"
          ? null
          : "DT Exchange is temporarily limiting new activity. Existing transactions continue to be tracked.",
    };
  }
  async list(actor: string, area: string, page = 1, search = "") {
    if (!permissions[area]) throw new NotFoundException();
    await this.permission(actor, permissions[area]);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 10000 ||
      search.length > 100
    )
      throw new BadRequestException();
    const offset = (page - 1) * 50;
    if (area === "settings") return [await this.status()];
    if (area === "providers") return providerReadiness();
    if (area === "ledger")
      return (
        await this.db.query("SELECT * FROM ledger_integrity_issues LIMIT 100")
      ).rows;
    if (area === "dashboard")
      return (
        await this.db.query(
          `SELECT (SELECT count(*)::text FROM users) total_users,(SELECT count(*)::text FROM users WHERE status='active') active_users,(SELECT count(*)::text FROM manual_deposit_requests WHERE status IN ('PROOF_SUBMITTED','UNDER_REVIEW','REQUIRES_MORE_INFORMATION')) pending_deposits,(SELECT count(*)::text FROM manual_deposit_requests WHERE status='CREDITED' AND updated_at >= date_trunc('day',now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') deposits_approved_today,(SELECT count(*)::text FROM sell_orders WHERE status='payout_pending') manual_payouts_pending,(SELECT count(*)::text FROM payouts WHERE lifecycle='SUCCESS') completed_payouts,((SELECT COALESCE(sum(amount),0) FROM deposits WHERE status='credited')+(SELECT COALESCE(sum(verified_amount),0) FROM manual_deposit_requests WHERE status='CREDITED'))::text usdt_deposits,(SELECT COALESCE(sum(q.amount_usdt),0)::text FROM sell_orders o JOIN quotes q ON q.id=o.quote_id WHERE o.status IN ('funded','payout_pending','payout_processing','completed')) usdt_sold,(SELECT count(*)::text FROM sell_orders WHERE status NOT IN ('completed','failed','expired','cancelled')) pending_orders,(SELECT COALESCE(sum(amount_inr_minor),0)::text FROM payouts WHERE lifecycle='SUCCESS') inr_paid_minor,(SELECT count(*)::text FROM payouts WHERE lifecycle IN ('QUEUED','SUBMITTED','PROCESSING')) pending_payouts,(SELECT count(*)::text FROM payouts WHERE lifecycle='FAILED') failed_payouts`,
        )
      ).rows;
    if (area === "users") {
      const result = await this.db.query(
        `SELECT u.id,u.status,u.created_at,u.email_ciphertext,u.mobile_ciphertext,p.full_name_ciphertext,
        (SELECT count(*)::text FROM bank_accounts b WHERE b.user_id=u.id AND disabled_at IS NULL) bank_accounts,
        ((SELECT count(*) FROM deposits d WHERE d.user_id=u.id)+(SELECT count(*) FROM manual_deposit_requests d WHERE d.user_id=u.id))::text deposit_history,
        (SELECT count(*)::text FROM sell_orders o WHERE o.user_id=u.id) sell_orders,
        (SELECT count(*)::text FROM payouts pay JOIN sell_orders o ON o.id=pay.order_id WHERE o.user_id=u.id) payouts,
        (SELECT max(created_at) FROM login_history l WHERE l.user_id=u.id AND l.success) last_login
        FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id
        WHERE ($1='' OR u.id::text ILIKE '%'||$1||'%') ORDER BY u.created_at DESC,u.id DESC LIMIT 50 OFFSET $2`,
        [search, offset],
      );
      return result.rows.map(({email_ciphertext,mobile_ciphertext,full_name_ciphertext,...row}) => ({
        ...row,
        name: full_name_ciphertext ? this.crypto.decrypt(full_name_ciphertext,row.id+":name") : null,
        email: email_ciphertext ? this.crypto.decrypt(email_ciphertext,row.id+":email") : null,
        mobile: mobile_ciphertext ? this.crypto.decrypt(mobile_ciphertext,row.id+":mobile") : null,
      }));
    }
    if (area === "verification")
      return (
        await this.db.query(
          "SELECT id,user_id,type,provider,status,submitted_at,reviewed_at,decision_code FROM verification_records ORDER BY submitted_at DESC,id DESC LIMIT 50 OFFSET $1",
          [offset],
        )
      ).rows;
    if (area === "banks")
      return (
        await this.db.query(
          "SELECT id,user_id,'XXXXXX'||last_four masked_account,ifsc,bank_name,verification_status,is_default,disabled_at FROM bank_accounts ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET $1",
          [offset],
        )
      ).rows;
    if (area === "wallets")
      return (
        await this.db.query(
          "SELECT account_id,user_id,asset_symbol,bucket,balance::text FROM ledger_balances ORDER BY account_id LIMIT 50 OFFSET $1",
          [offset],
        )
      ).rows;
    if (area === "audit")
      return (
        await this.db.query(
          "SELECT id,actor_type,actor_id,action,entity_type,entity_id,request_id,created_at FROM audit_logs ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET $1",
          [offset],
        )
      ).rows;
    if (area === "health" || area === "queues")
      return (
        await this.db.query(
          "SELECT worker,last_seen_at,state,CASE WHEN last_seen_at>now()-interval '2 minutes' THEN 'CURRENT' ELSE 'STALE' END freshness FROM worker_heartbeats ORDER BY worker",
        )
      ).rows;
    // Expose only non-secret, explicitly allowlisted policy values.
    return (
      await this.db.query(
        "SELECT p.id,p.version,p.mode,p.effective_from AS rate_last_updated_at,p.manual_rate::text,p.margin_bps,p.spread_bps,p.minimum_sell::text,p.maximum_sell::text,p.daily_limit::text,p.monthly_limit::text,p.quote_expiry_seconds,f.flat_inr_minor::text,f.basis_points FROM rate_policies p JOIN fees f ON f.id=p.fee_id ORDER BY p.version DESC LIMIT 50",
      )
    ).rows;
  }
  async controls(actor: string, input: any) {
    await this.permission(actor, "settings.write");
    if (
      typeof input.reason !== "string" ||
      input.reason.trim().length < 10 ||
      input.reason.length > 500 ||
      !Number.isInteger(input.version) ||
      Object.keys(input).some(
        (k) => !["reason", "version", "controls"].includes(k),
      )
    )
      throw new BadRequestException();
    const value = validateControls(input.controls);
    return this.db.transaction(async (tx) => {
      const old = (
        await tx.query(
          "SELECT value,version FROM system_settings WHERE key='operational_controls' FOR UPDATE",
        )
      ).rows[0];
      if (!old) throw new ConflictException("Configuration unavailable");
      if (old.version !== input.version)
        throw new ConflictException("Configuration changed");
      await tx.query(
        "UPDATE system_settings SET value=$1,version=version+1,updated_by=$2,updated_at=now() WHERE key='operational_controls'",
        [JSON.stringify(value), actor],
      );
      await tx.query(
        "INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES('admin',$1,'operations.controls','settings','operational_controls',gen_random_uuid(),$2)",
        [
          actor,
          JSON.stringify({
            before: old.value,
            after: value,
            reason: input.reason.replace(/[\x00-\x1f]/g, " "),
          }),
        ],
      );
      return { saved: true, version: old.version + 1 };
    });
  }
  async verificationNote(actor: string, id: string, input: any) {
    await this.permission(actor, "verification.review");
    if (
      typeof input.reason !== "string" ||
      input.reason.trim().length < 10 ||
      input.reason.length > 500 ||
      Object.keys(input).some((k) => k !== "reason")
    )
      throw new BadRequestException();
    return this.db.transaction(async (tx) => {
      if (
        !(
          await tx.query(
            "SELECT id FROM verification_records WHERE id=$1 FOR UPDATE",
            [id],
          )
        ).rows.length
      )
        throw new NotFoundException();
      await tx.query(
        "INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES('admin',$1,'verification.review_note','verification',$2,gen_random_uuid(),$3)",
        [
          actor,
          id,
          JSON.stringify({ reason: input.reason.replace(/[\x00-\x1f]/g, " ") }),
        ],
      );
      return { saved: true, providerDecisionUnchanged: true };
    });
  }
  async policy(actor: string, input: any) {
    await this.permission(actor, "settings.write");
    const keys = [
      "version",
      "reason",
      "mode",
      "manualRate",
      "minimumSell",
      "maximumSell",
      "dailyLimit",
      "monthlyLimit",
      "marginBps",
      "spreadBps",
      "feeBasisPoints",
      "fixedFeeMinor",
      "quoteExpiry",
    ];
    if (
      Object.keys(input).some((k) => !keys.includes(k)) ||
      typeof input.reason !== "string" ||
      input.reason.length < 10 ||
      input.reason.length > 500 ||
      !Number.isInteger(input.version) ||
      ![
        "manual",
        "market",
        "market_plus_margin",
        "market_minus_margin",
      ].includes(input.mode)
    )
      throw new BadRequestException();
    const amount = (v: any) => {
      if (typeof v !== "string" || !/^\d{1,12}(\.\d{1,6})?$/.test(v))
        throw new BadRequestException();
      const [a, b = ""] = v.split(".");
      return BigInt(a!) * 1000000n + BigInt(b.padEnd(6, "0"));
    };
    const min = amount(input.minimumSell),
      max = amount(input.maximumSell),
      daily = amount(input.dailyLimit),
      monthly = amount(input.monthlyLimit);
    if (
      min <= 0n ||
      max < min ||
      daily < max ||
      monthly < daily ||
      (input.mode === "manual" && amount(input.manualRate) <= 0n)
    )
      throw new BadRequestException();
    for (const k of ["marginBps", "spreadBps", "feeBasisPoints"])
      if (!Number.isInteger(input[k]) || input[k] < 0 || input[k] > 9999)
        throw new BadRequestException();
    if (
      typeof input.fixedFeeMinor !== "string" ||
      !/^\d{1,12}$/.test(input.fixedFeeMinor) ||
      !Number.isInteger(input.quoteExpiry) ||
      input.quoteExpiry < 15 ||
      input.quoteExpiry > 600
    )
      throw new BadRequestException();
    return this.db.transaction(async (tx) => {
      await tx.query(
        "SELECT key FROM system_settings WHERE key='operational_controls' FOR UPDATE",
      );
      const current = (
        await tx.query(
          "SELECT version FROM rate_policies ORDER BY version DESC LIMIT 1",
        )
      ).rows[0];
      if ((current?.version ?? 0) !== input.version)
        throw new ConflictException("Policy changed");
      const fee = (
        await tx.query(
          "INSERT INTO fees(version,flat_inr_minor,basis_points,effective_from) SELECT COALESCE(max(version),0)+1,$1,$2,now() FROM fees RETURNING id",
          [input.fixedFeeMinor, input.feeBasisPoints],
        )
      ).rows[0]!;
      await tx.query(
        "INSERT INTO rate_policies(version,mode,manual_rate,margin_bps,spread_bps,minimum_sell,maximum_sell,daily_limit,monthly_limit,quote_expiry_seconds,maximum_rate_age_seconds,fee_id,effective_from,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,120,$11,now(),$12)",
        [
          input.version + 1,
          input.mode,
          input.mode === "manual" ? input.manualRate : null,
          input.marginBps,
          input.spreadBps,
          input.minimumSell,
          input.maximumSell,
          input.dailyLimit,
          input.monthlyLimit,
          input.quoteExpiry,
          fee.id,
          actor,
        ],
      );
      await tx.query(
        "INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES('admin',$1,'rate.policy','rate_policy',$2,gen_random_uuid(),$3)",
        [
          actor,
          String(input.version + 1),
          JSON.stringify({
            previousVersion: input.version,
            reason: input.reason.replace(/[\x00-\x1f]/g, " "),
          }),
        ],
      );
      return {
        saved: true,
        version: input.version + 1,
        acceptedQuotesUnchanged: true,
      };
    });
  }
  async userAction(actor: string, id: string, input: any) {
    await this.permission(actor, "users.manage");
    if (
      !["active", "frozen", "suspended"].includes(input.status) ||
      typeof input.reason !== "string" ||
      input.reason.trim().length < 10 ||
      input.reason.length > 500 ||
      Object.keys(input).some((k) => !["status", "reason"].includes(k))
    )
      throw new BadRequestException();
    return this.db.transaction(async (tx) => {
      const row = (
        await tx.query("SELECT status FROM users WHERE id=$1 FOR UPDATE", [id])
      ).rows[0];
      if (!row) throw new NotFoundException();
      if (["disabled", "closed", "pending"].includes(row.status))
        throw new ConflictException(
          "Account requires activation or retention review",
        );
      await tx.query(
        "UPDATE users SET status=$2,updated_at=now() WHERE id=$1",
        [id, input.status],
      );
      if (input.status !== "active")
        await tx.query(
          "UPDATE sessions SET revoked_at=now(),revoke_reason='ADMIN_ACCOUNT_REVIEW' WHERE user_id=$1 AND revoked_at IS NULL",
          [id],
        );
      await tx.query(
        "INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES('admin',$1,'user.status','user',$2,gen_random_uuid(),$3)",
        [
          actor,
          id,
          JSON.stringify({
            before: row.status,
            after: input.status,
            reason: input.reason.replace(/[\x00-\x1f]/g, " "),
          }),
        ],
      );
      return { saved: true };
    });
  }
}
@Public()
@Controller("system")
export class SystemController {
  constructor(private readonly ops: OperationsService) {}
  @Get("status") status() {
    return this.ops.status();
  }
}

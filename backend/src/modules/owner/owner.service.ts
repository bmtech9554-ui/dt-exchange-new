import {checkDepositLimits} from "../manual/deposit-limits";
import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { statfs, readFile } from "node:fs/promises";
import { HealthController } from "../../health/health.controller";
import { localLoggingHealth } from "../../common/local-logging-health";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DatabaseService, SqlClient } from "../../common/database.service";
import { CryptoService } from "../../common/crypto.service";
import { OperationsService } from "../../common/operations.service";
import { LedgerService } from "../ledger/ledger.service";
import { decimal, databaseUnits, format } from "../rates/money";
const text = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(/^[^<>\x00-\x1f]*$/);
const reason = text.min(10);
const money = z.string().regex(/^\d{1,12}(\.\d{1,6})?$/);
const confirmation = {
  confirm: z.literal(true),
  reason,
  version: z.number().int().positive(),
};
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new BadRequestException("Invalid or missing fields");
  return r.data;
}
@Injectable()
export class OwnerService {
  constructor(
    private db: DatabaseService,
    private crypto: CryptoService,
    private ops: OperationsService,
    private ledger: LedgerService,
  ) {}
  async permission(actor: string, code: string) {
    await this.ops.permission(actor, code);
  }
  async audit(
    tx: SqlClient,
    actor: string,
    action: string,
    id: string,
    changes: unknown,
  ) {
    await tx.query(
      "INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES('admin',$1,$2,'owner_operation',$3,gen_random_uuid(),$4)",
      [actor, action, id, JSON.stringify(changes)],
    );
  }
  private userView(r: any) {
    return {
      id: r.id,
      publicUserId: r.public_user_id == null ? null : String(r.public_user_id),
      status: r.status,
      version: r.admin_version,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      lastLogin: r.last_login ?? null,
      name: r.full_name_ciphertext
        ? this.crypto.decrypt(r.full_name_ciphertext, r.id + ":name")
        : null,
      email: r.email_ciphertext
        ? this.crypto.decrypt(r.email_ciphertext, r.id + ":email")
        : null,
      mobile: r.mobile_ciphertext
        ? this.crypto.decrypt(r.mobile_ciphertext, r.id + ":mobile")
        : null,
      balance: r.balance ?? "0",
      totalDeposits: r.total_deposits ?? "0",
      totalSold: r.total_sold ?? "0",
      bankCount: r.bank_count ?? "0",
      pendingBalance: r.pending_balance ?? "0",
      totalPayoutInrMinor: r.total_payout_inr_minor ?? "0",
    };
  }
  async users(actor: string, query: any) {
    await this.permission(actor, "users.read");
    const q = parse(
      z
        .object({
          page: z.coerce.number().int().min(1).max(10000).default(1),
          search: z.string().trim().max(100).default(""),
          status: z
            .enum(["", "pending", "active", "frozen", "suspended", "closed"])
            .default(""),
          sort: z.enum(["newest", "oldest"]).default("newest"),
          from: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          to: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        })
        .strict(),
      query,
    );
    const email = q.search.includes("@")
      ? this.crypto.digest(q.search.toLowerCase(), "email")
      : "";
    const mobile = /^(\+91)?[6-9]\d{9}$/.test(q.search)
      ? this.crypto.digest(
          q.search.startsWith("+") ? q.search : "+91" + q.search,
          "mobile",
        )
      : "";
    const params = [
      q.search,
      q.status,
      email,
      mobile,
      q.from ?? null,
      q.to ?? null,
    ];
    const where =
      "($1='' OR u.public_user_id::text=$1 OR u.id::text ILIKE '%'||$1||'%' OR u.email_lookup_hash=$3 OR u.mobile_lookup_hash=$4) AND ($2='' OR u.status::text=$2) AND ($5::date IS NULL OR u.created_at>=($5::date::timestamp AT TIME ZONE 'Asia/Kolkata')) AND ($6::date IS NULL OR u.created_at<(($6::date+1)::timestamp AT TIME ZONE 'Asia/Kolkata'))";
    const rows = (
      await this.db.query(
        `SELECT u.id,u.public_user_id,u.status,u.admin_version,u.created_at,u.updated_at,u.email_ciphertext,u.mobile_ciphertext,p.full_name_ciphertext,
  (SELECT max(created_at) FROM login_history WHERE user_id=u.id AND success) last_login,
  (SELECT coalesce(sum(balance),0)::text FROM ledger_balances WHERE user_id=u.id AND asset_symbol='USDT' AND bucket='available') balance,
  (SELECT count(*)::text FROM bank_accounts WHERE user_id=u.id AND disabled_at IS NULL) bank_count,
  (SELECT coalesce(sum(balance),0)::text FROM ledger_balances WHERE user_id=u.id AND asset_symbol='USDT' AND bucket='reserved') pending_balance,
  (SELECT coalesce(sum(p.amount_inr_minor),0)::text FROM payouts p JOIN sell_orders o ON o.id=p.order_id WHERE o.user_id=u.id AND p.lifecycle='SUCCESS') total_payout_inr_minor,
  ((SELECT coalesce(sum(amount),0) FROM deposits WHERE user_id=u.id AND status='credited')+(SELECT coalesce(sum(verified_amount),0) FROM manual_deposit_requests WHERE user_id=u.id AND status='CREDITED'))::text total_deposits,
  (SELECT coalesce(sum(q.amount_usdt),0)::text FROM sell_orders o JOIN quotes q ON q.id=o.quote_id WHERE o.user_id=u.id AND o.status IN ('funded','payout_pending','payout_processing','completed')) total_sold
  FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id WHERE ${where} ORDER BY u.created_at ${q.sort === "oldest" ? "ASC" : "DESC"},u.id LIMIT 50 OFFSET $7`,
        [...params, (q.page - 1) * 50],
      )
    ).rows;
    const total = (
      await this.db.query(
        `SELECT count(*)::text total FROM users u WHERE ${where}`,
        params,
      )
    ).rows[0]!.total;
    return { items: rows.map((r) => this.userView(r)), total, page: q.page };
  }
  async user(actor: string, id: string, query: any = {}) {
    const page=parse(z.object({page:z.coerce.number().int().min(1).max(10000).default(1),section:z.enum(["banks","referralRewards","referrals","activity","deposits","orders","payouts","support","notes"]).optional()}).strict(),query);
    await this.permission(actor, "users.read");
    const r = (
      await this.db.query(
        "SELECT u.*,p.full_name_ciphertext FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id WHERE u.id=$1",
        [id],
      )
    ).rows[0];
    if (!r) throw new NotFoundException();
    const summary=(await this.users(actor,{search:id})).items.find(item=>item.id===id);
    const data: Record<string, unknown> = { user: summary??this.userView(r) };
    await Promise.all(Object.entries({
      banks: "SELECT id,user_id,holder_name_ciphertext,last_four,ifsc,bank_name,branch,account_type,verification_status,self_declared,disabled_at,created_at,admin_version FROM bank_accounts WHERE user_id=$1 ORDER BY created_at DESC,id LIMIT 50",
      referralCode:"SELECT code FROM referral_codes WHERE user_id=$1",
      referralRewards:"SELECT e.id,e.amount_usdt::text,e.created_at,x.created_at released_at FROM referral_reward_entries e LEFT JOIN referral_reward_releases x ON x.reward_id=e.id WHERE e.user_id=$1 ORDER BY e.created_at DESC LIMIT 50",
      referrals: "SELECT r.id,r.code,r.status,r.created_at,u.public_user_id::text referrer_public_id,v.public_user_id::text referred_public_id FROM referrals r JOIN users u ON u.id=r.referrer_id JOIN users v ON v.id=r.referred_user_id WHERE r.referrer_id=$1 OR r.referred_user_id=$1 ORDER BY r.created_at DESC LIMIT 50",
      activity:"SELECT action,created_at,entity_type,entity_id FROM audit_logs WHERE actor_id=$1 OR entity_id=$1::text ORDER BY created_at DESC,id LIMIT 50",
      wallet:
        "SELECT asset_symbol,bucket,balance::text FROM ledger_balances WHERE user_id=$1",
      deposits:
        "SELECT id,submitted_amount::text,verified_amount::text,tx_hash,status,created_at FROM manual_deposit_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
      orders:
        "SELECT id,quote_id,status,accepted_at FROM sell_orders WHERE user_id=$1 ORDER BY accepted_at DESC LIMIT 50",
      payouts:
        "SELECT p.id,p.lifecycle,p.amount_inr_minor::text,p.utr,p.created_at FROM payouts p JOIN sell_orders o ON o.id=p.order_id WHERE o.user_id=$1 ORDER BY p.created_at DESC LIMIT 50",
      support:
        "SELECT id,subject,status,created_at FROM support_tickets WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
      notes:
        "SELECT id,admin_id,body_ciphertext,created_at FROM owner_user_notes WHERE user_id=$1 ORDER BY created_at DESC,id LIMIT 50",
    }).filter(([key])=>!page.section||key===page.section).map(async ([key,sql])=>{
      const paged=!!page.section;
      const rows = (await this.db.query(paged?sql.replace(/LIMIT (50|100)$/, "LIMIT 50 OFFSET $2"):sql,paged?[id,(page.page-1)*50]:[id])).rows;
      data[key] =
        key === 'banks' ? rows.map(({holder_name_ciphertext,...b})=>({...b,publicUserId:summary?.publicUserId??null,holder:this.crypto.decrypt(holder_name_ciphertext,b.id+':holder'),accountNumber:'XXXXXX'+b.last_four})) : key === "notes"
          ? rows.map(({ body_ciphertext, ...n }) => ({
              ...n,
              note: this.crypto.decrypt(body_ciphertext, "owner-note:" + n.id),
            }))
          : rows;
    }));
    return {...data,recordsPage:page.page};
  }
  async closeUser(actor:string,id:string,body:unknown){
    await this.permission(actor,'users.close');const b=parse(z.object(confirmation).strict(),body);
    return this.db.transaction(async tx=>{
      const user=(await tx.query('SELECT status,admin_version FROM users WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if(!user)throw new NotFoundException();
      if(user.status==='closed')return {status:'DEACTIVATED',financialRecordsRetained:true};
      if(user.admin_version!==b.version)throw new ConflictException('User changed; reload');
      const obligations=(await tx.query(`SELECT 1 FROM sell_orders WHERE user_id=$1 AND status NOT IN ('completed','cancelled','expired','failed')
        UNION ALL SELECT 1 FROM ledger_balances WHERE user_id=$1 AND balance<>0
        UNION ALL SELECT 1 FROM manual_deposit_requests WHERE user_id=$1 AND status NOT IN ('CREDITED','REJECTED')
        UNION ALL SELECT 1 FROM referral_reward_entries e JOIN referrals r ON r.id=e.referral_id WHERE e.user_id=$1 AND r.lifecycle<>'REJECTED' AND NOT EXISTS(SELECT 1 FROM referral_reward_releases x WHERE x.reward_id=e.id) LIMIT 1`,[id])).rows.length;
      if(obligations)throw new ConflictException('Resolve pending transactions, rewards and balances before closure. Suspension remains available.');
      await tx.query("INSERT INTO account_deletion_requests(user_id,status,reason_ciphertext) VALUES($1,'DEACTIVATED',$2) ON CONFLICT(user_id) DO NOTHING",[id,this.crypto.encrypt(b.reason,'deletion:'+id)]);
      await tx.query("UPDATE users SET status='closed',updated_at=now() WHERE id=$1",[id]);
      await tx.query('UPDATE sessions SET revoked_at=coalesce(revoked_at,now()) WHERE user_id=$1',[id]);
      await tx.query('UPDATE notification_devices SET revoked_at=coalesce(revoked_at,now()) WHERE user_id=$1',[id]);
      await this.audit(tx,actor,'owner.user.closed',id,{reason:b.reason,financialRecordsRetained:true,anonymization:'RETENTION_REVIEW_REQUIRED'});
      return {status:'DEACTIVATED',financialRecordsRetained:true,anonymization:'RETENTION_REVIEW_REQUIRED'};
    });
  }
  async revealBank(actor:string,id:string,body:unknown){
    await this.permission(actor,'banks.reveal');const b=parse(z.object({confirm:z.literal(true),reason}).strict(),body);
    return this.db.transaction(async tx=>{const row=(await tx.query('SELECT account_number_ciphertext FROM bank_accounts WHERE id=$1',[id])).rows[0];if(!row)throw new NotFoundException();
      await this.audit(tx,actor,'owner.bank.revealed',id,{reason:b.reason});
      return {accountNumber:this.crypto.decrypt(row.account_number_ciphertext,id+':number')};
    });
  }
  async disableBank(actor:string,id:string,body:unknown){
    await this.permission(actor,'banks.manage');const b=parse(z.object(confirmation).strict(),body);
    return this.db.transaction(async tx=>{
      const initial=(await tx.query('SELECT user_id FROM bank_accounts WHERE id=$1',[id])).rows[0];if(!initial)throw new NotFoundException();
      await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[initial.user_id]);
      const old=(await tx.query('SELECT * FROM bank_accounts WHERE id=$1 FOR UPDATE',[id])).rows[0]!;
      if(old.disabled_at)return {disabled:true};if(old.admin_version!==b.version)throw new ConflictException('Bank changed; reload');
      if((await tx.query("SELECT 1 FROM sell_orders WHERE bank_account_id=$1 AND status NOT IN ('completed','failed','cancelled','expired') LIMIT 1",[id])).rows.length)throw new ConflictException('Resolve active payout obligations first');
      await tx.query('UPDATE bank_accounts SET disabled_at=now(),is_default=false,updated_at=now() WHERE id=$1',[id]);
      await this.audit(tx,actor,'owner.bank.disabled',id,{reason:b.reason,lastFour:old.last_four,financialRecordsRetained:true});return {disabled:true};
    });
  }
  async editUser(actor: string, id: string, body: unknown) {
    await this.permission(actor, "users.edit");
    const b = parse(
      z
        .object({
          ...confirmation,
          name: text.max(100),
          email: z.string().email().max(254),
          mobile: z.string().regex(/^\+91[6-9]\d{9}$/),
          status: z.enum(["active", "frozen", "suspended"]),
        })
        .strict(),
      body,
    );
    return this.db.transaction(async (tx) => {
      const old = (
        await tx.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [id])
      ).rows[0];
      if (!old) throw new NotFoundException();
      if (old.admin_version !== b.version)
        throw new ConflictException("User changed; reload");
      if (["pending", "closed"].includes(old.status))
        throw new ConflictException(
          "Activation or retention workflow required",
        );
      const email = b.email.trim().toLowerCase(),
        eh = this.crypto.digest(email, "email"),
        mh = this.crypto.digest(b.mobile, "mobile");
      if (
        (
          await tx.query(
            "SELECT id FROM users WHERE id<>$1 AND (email_lookup_hash=$2 OR mobile_lookup_hash=$3)",
            [id, eh, mh],
          )
        ).rows.length
      )
        throw new ConflictException("Contact already belongs to an account");
      await tx.query(
        "UPDATE users SET email_ciphertext=$2,email_lookup_hash=$3,mobile_ciphertext=$4,mobile_lookup_hash=$5,email_verified_at=CASE WHEN email_lookup_hash=$3 THEN email_verified_at ELSE NULL END,mobile_verified_at=CASE WHEN mobile_lookup_hash=$5 THEN mobile_verified_at ELSE NULL END,status=$6,updated_at=now() WHERE id=$1",
        [
          id,
          this.crypto.encrypt(email, id + ":email"),
          eh,
          this.crypto.encrypt(b.mobile, id + ":mobile"),
          mh,
          b.status,
        ],
      );
      await tx.query(
        "INSERT INTO user_profiles(user_id,full_name_ciphertext) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET full_name_ciphertext=excluded.full_name_ciphertext,updated_at=now()",
        [id, this.crypto.encrypt(b.name, id + ":name")],
      );
      if (
        eh !== old.email_lookup_hash ||
        mh !== old.mobile_lookup_hash ||
        b.status !== "active"
      )
        await tx.query(
          "UPDATE sessions SET revoked_at=now(),revoke_reason='OWNER_PROFILE_CHANGE' WHERE user_id=$1 AND revoked_at IS NULL",
          [id],
        );
      await this.audit(tx, actor, "owner.user.edit", id, {
        reason: b.reason,
        statusBefore: old.status,
        statusAfter: b.status,
        contactChanged:
          eh !== old.email_lookup_hash || mh !== old.mobile_lookup_hash,
        nameChanged: true,
      });
      return { saved: true };
    });
  }
  async note(actor: string, id: string, body: unknown) {
    await this.permission(actor, "users.edit");
    const b = parse(
      z.object({ note: text, confirm: z.literal(true) }).strict(),
      body,
    );
    return this.db.transaction(async (tx) => {
      if (
        !(await tx.query("SELECT id FROM users WHERE id=$1", [id])).rows.length
      )
        throw new NotFoundException();
      const noteId = randomUUID();
      await tx.query(
        "INSERT INTO owner_user_notes(id,user_id,admin_id,body_ciphertext) VALUES($1,$2,$3,$4)",
        [
          noteId,
          id,
          actor,
          this.crypto.encrypt(b.note, "owner-note:" + noteId),
        ],
      );
      await this.audit(tx, actor, "owner.user.note", id, { noteId });
      return { saved: true };
    });
  }
  async wallet(actor: string, id: string) {
    await this.permission(actor, "wallets.read");
    return {
      totals:(await this.db.query("SELECT (SELECT coalesce(sum(net_credited_amount),0)::text FROM manual_deposit_requests WHERE user_id=$1 AND status='CREDITED') credited_usdt,(SELECT coalesce(sum(q.amount_usdt),0)::text FROM sell_orders o JOIN quotes q ON q.id=o.quote_id WHERE o.user_id=$1 AND o.status IN ('funded','payout_pending','payout_processing','completed','failed')) sold_usdt",[id])).rows[0],
      balances: (
        await this.db.query(
          "SELECT asset_symbol,bucket,balance::text FROM ledger_balances WHERE user_id=$1",
          [id],
        )
      ).rows,
      entries: (
        await this.db.query(
          "SELECT j.id,j.event_type,j.source_id,j.event_key,j.created_at,e.side,e.amount::text,e.asset_symbol,a.bucket FROM ledger_entries e JOIN ledger_journals j ON j.id=e.journal_id JOIN ledger_accounts a ON a.id=e.account_id WHERE a.user_id=$1 ORDER BY j.created_at DESC,e.id LIMIT 100",
          [id],
        )
      ).rows,
      adjustments: (
        await this.db.query(
          "SELECT id,amount::text,direction,reason,admin_id,created_at FROM owner_wallet_adjustments WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
          [id],
        )
      ).rows,
    };
  }
  async adjust(actor: string, id: string, body: unknown) {
    await this.permission(actor, "wallets.adjust");
    if(process.env.TRANSACTIONS_ENABLED!=='true'||process.env.OWNER_WALLET_ADJUSTMENTS_ENABLED==='false')throw new ForbiddenException('Financial execution paused');
    const b = parse(
      z
        .object({
          confirm: z.literal(true),
          reason,
          amount: money,
          direction: z.enum(["credit", "debit"]),
          requestId: z.string().uuid(),
        })
        .strict(),
      body,
    );
    if (decimal(b.amount, 6) <= 0n)
      throw new BadRequestException("Positive amount required");
    return this.db.transaction(async (tx) => {
      const u = (
        await tx.query("SELECT status FROM users WHERE id=$1 FOR UPDATE", [id])
      ).rows[0];
      if (!u) throw new NotFoundException();
      if (u.status !== "active")
        throw new ConflictException("Active account required");
      if (
        (
          await tx.query(
            "SELECT 1 FROM system_settings WHERE key='synthetic_device_validation' AND value->>'userId'=$1",
            [id],
          )
        ).rows.length
      )
        throw new ForbiddenException(
          "Synthetic test accounts cannot receive real balance adjustments",
        );
      const prior = (
        await tx.query("SELECT * FROM owner_wallet_adjustments WHERE id=$1", [
          b.requestId,
        ])
      ).rows[0];
      if (prior) {
        if (
          prior.user_id !== id ||
          prior.admin_id !== actor ||
          decimal(String(prior.amount), 6) !== decimal(b.amount, 6) ||
          prior.direction !== b.direction ||
          prior.reason !== b.reason
        )
          throw new ConflictException(
            "Adjustment key reused with different terms",
          );
        return { saved: true, duplicate: true };
      }
      const available = await this.ledger.account(tx, id, "USDT", "available"),
        offset = await this.ledger.account(
          tx,
          null,
          "USDT",
          "adjustment",
          "equity",
        );
      await tx.query(
        "SELECT id FROM ledger_accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
        [[available, offset]],
      );
      const balance =
        (
          await tx.query(
            "SELECT balance::text FROM ledger_balances WHERE account_id=$1",
            [available],
          )
        ).rows[0]?.balance ?? "0";
      if (
        b.direction === "debit" &&
        databaseUnits(balance, 6) < decimal(b.amount, 6)
      )
        throw new ConflictException("Insufficient available balance");
      await tx.query(
        "INSERT INTO owner_wallet_adjustments(id,user_id,admin_id,amount,direction,reason) VALUES($1,$2,$3,$4,$5,$6)",
        [b.requestId, id, actor, b.amount, b.direction, b.reason],
      );
      await this.ledger.post(
        tx,
        "owner-adjustment:" + b.requestId,
        "adjustment",
        b.requestId,
        [
          {
            account: available,
            asset: "USDT",
            side: b.direction === "credit" ? "credit" : "debit",
            amount: b.amount,
          },
          {
            account: offset,
            asset: "USDT",
            side: b.direction === "credit" ? "debit" : "credit",
            amount: b.amount,
          },
        ],
        undefined,
        actor,
      );
      await this.audit(tx, actor, "owner.wallet.adjustment", id, {
        requestId: b.requestId,
        amount: b.amount,
        direction: b.direction,
        reason: b.reason,
      });
      return { saved: true, reference: b.requestId };
    });
  }
  async config(actor: string, section: string) {
    if (!["maintenance", "website", "app"].includes(section))
      throw new NotFoundException();
    await this.permission(
      actor,
      section === "maintenance" ? "maintenance.manage" : "public.settings",
    );
    const key =
      section === "maintenance" ? "owner_maintenance" : "owner_public_config";
    return (
      await this.db.query(
        "SELECT value,version,updated_at FROM system_settings WHERE key=$1",
        [key],
      )
    ).rows[0];
  }
  async saveConfig(actor: string, section: string, body: unknown) {
    if (!["maintenance", "website", "app"].includes(section))
      throw new NotFoundException();
    await this.permission(
      actor,
      section === "maintenance" ? "maintenance.manage" : "public.settings",
    );
    const schema =
      section === "maintenance"
        ? z.object({
            app: z.boolean(),
            website: z.boolean(),
            api: z.boolean(),
            message: text,
            scheduledAt: z.string().datetime().nullable(),
          })
        : z.object({
            telegram: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{4,31}$/),
            contactEmail: z.union([z.literal(""), z.string().email().max(254)]),
            announcement: z
              .string()
              .max(500)
              .regex(/^[^<>\x00-\x1f]*$/),
            informationalText: z
              .string()
              .max(2000)
              .regex(/^[^<>\x00-\x1f]*$/),
            downloadVisible: z.boolean(),
          });
    const b = parse(
        z.object({ ...confirmation, value: schema.strict() }).strict(),
        body,
      ),
      key =
        section === "maintenance" ? "owner_maintenance" : "owner_public_config";
    return this.db.transaction(async (tx) => {
      const old = (
        await tx.query(
          "SELECT value,version FROM system_settings WHERE key=$1 FOR UPDATE",
          [key],
        )
      ).rows[0];
      if (!old || old.version !== b.version)
        throw new ConflictException("Configuration changed; reload");
      const value = {
        ...b.value,
        ...(section === "maintenance"
          ? { startedAt: new Date().toISOString() }
          : {}),
      };
      await tx.query(
        "UPDATE system_settings SET value=$2,version=version+1,updated_by=$3,updated_at=now() WHERE key=$1",
        [key, JSON.stringify(value), actor],
      );
      await this.audit(tx, actor, "owner." + section + ".changed", key, {
        before: old.value,
        after: value,
        reason: b.reason,
      });
      return { saved: true };
    });
  }
  async publicConfig() {
    const rows = (
      await this.db.query(
        "SELECT key,value,version FROM system_settings WHERE key IN ('owner_public_config','owner_maintenance')",
      )
    ).rows;
    const config = rows.find((r) => r.key === "owner_public_config")?.value;
    const maintenance = rows.find((r) => r.key === "owner_maintenance")?.value;
    const active =
      maintenance &&
      (!maintenance.scheduledAt ||
        Date.parse(maintenance.scheduledAt) <= Date.now());
    return {
      config: config ?? null,
      maintenance: maintenance
        ? {
            ...maintenance,
            app: active && maintenance.app,
            website: active && maintenance.website,
            api: active && maintenance.api,
          }
        : null,
    };
  }
  async banks(actor: string, page = 1) {
    await this.permission(actor, "banks.read");
    if (!Number.isInteger(page) || page < 1 || page > 10000)
      throw new BadRequestException();
    const rows = (
      await this.db.query(
        "SELECT b.id,b.user_id,u.public_user_id::text,p.full_name_ciphertext,b.self_declared,b.holder_name_ciphertext,b.last_four,b.ifsc,b.bank_name,b.branch,b.account_type,b.verification_status,b.is_default,b.disabled_at,b.created_at,b.admin_version FROM bank_accounts b JOIN users u ON u.id=b.user_id LEFT JOIN user_profiles p ON p.user_id=b.user_id ORDER BY b.created_at DESC,b.id LIMIT 50 OFFSET $1",
        [(page - 1) * 50],
      )
    ).rows;
    return rows.map(({ holder_name_ciphertext, full_name_ciphertext, ...b }) => ({
      ...b,
      userName:full_name_ciphertext?this.crypto.decrypt(full_name_ciphertext,b.user_id+":name"):null,
      holder: this.crypto.decrypt(holder_name_ciphertext, b.id + ":holder"),
      accountNumber: "XXXXXX" + b.last_four,
    }));
  }
  async order(actor:string,id:string){
    await this.permission(actor,'orders.read');await this.permission(actor,'users.read');await this.permission(actor,'banks.read');
    const row=(await this.db.query(`SELECT o.*,q.amount_usdt::text,q.rate_inr::text,q.net_inr_minor::text,q.fee_inr_minor::text,
      b.holder_name_ciphertext,b.bank_name,b.ifsc,b.last_four,b.branch,b.account_type,p.id payout_id,p.lifecycle payout_status,p.utr,p.manual_receipt_id,p.manual_note,p.manual_paid_at
      FROM sell_orders o JOIN quotes q ON q.id=o.quote_id JOIN bank_accounts b ON b.id=o.bank_account_id LEFT JOIN payouts p ON p.order_id=o.id WHERE o.id=$1`,[id])).rows[0];
    if(!row)throw new NotFoundException();
    const {holder_name_ciphertext,...order}=row;
    const user=(await this.db.query('SELECT u.id,u.public_user_id,u.status,u.email_ciphertext,u.mobile_ciphertext,p.full_name_ciphertext FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id WHERE u.id=$1',[row.user_id])).rows[0];
    return {order:{...order,holder:this.crypto.decrypt(holder_name_ciphertext,row.bank_account_id+':holder'),accountNumber:'XXXXXX'+row.last_four},user:this.userView(user),
      history:(await this.db.query('SELECT from_status,to_status,note,actor_id,created_at FROM manual_action_history WHERE entity_id=$1 ORDER BY sequence',[id])).rows};
  }
  async editBank(actor: string, id: string, body: unknown) {
    await this.permission(actor, "banks.manage");
    const b = parse(
      z
        .object({
          ...confirmation,
          holder: text.max(100),
          bankName: text.max(100),
          branch: z
            .string()
            .max(100)
            .regex(/^[^<>\x00-\x1f]*$/),
          accountType: z.enum(["savings", "current", "other"]).nullable(),
        })
        .strict(),
      body,
    );
    return this.db.transaction(async (tx) => {
      const old = (
        await tx.query("SELECT * FROM bank_accounts WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0];
      if (!old) throw new NotFoundException();
      if (old.admin_version !== b.version)
        throw new ConflictException("Bank record changed");
      if (
        old.disabled_at ||
        (
          await tx.query(
            "SELECT 1 FROM sell_orders WHERE bank_account_id=$1 AND status NOT IN ('completed','failed','expired','cancelled') LIMIT 1",
            [id],
          )
        ).rows.length
      )
        throw new ConflictException(
          "Bank account has active obligations or is disabled",
        );
      if (
        this.crypto.decrypt(old.holder_name_ciphertext, id + ":holder") !==
          b.holder ||
        old.bank_name !== b.bankName
      )
        throw new ConflictException(
          "Bank identity is immutable; add a new validated replacement account",
        );
      await tx.query(
        "UPDATE bank_accounts SET branch=$2,account_type=$3,updated_at=now() WHERE id=$1",
        [id, b.branch, b.accountType],
      );
      await this.audit(tx, actor, "owner.bank.corrected", id, {
        reason: b.reason,
        lastFour: old.last_four,
        before: { branch: old.branch, accountType: old.account_type },
        after: { branch: b.branch, accountType: b.accountType },
        acceptedBeneficiariesUnchanged: true,
      });
      return { saved: true };
    });
  }
  depositView(d:any){
    const rate=d.rate_snapshot?.rateInr;
    const value=d.net_credited_amount??d.verified_amount??d.submitted_amount;
    return {...d,inr_equivalent:typeof rate==='string'?format(databaseUnits(String(value),6)*databaseUnits(rate,8)/1000000000000n,2):null,rate_snapshot_status:rate?'Recorded at submission':'Not recorded for this historical request'};
  }
  async deposits(actor:string,query:unknown){
    await this.permission(actor,'DEPOSIT_REVIEW');await this.permission(actor,'users.read');
    const q=parse(z.object({page:z.coerce.number().int().min(1).max(10000).default(1),status:z.enum(['','UNDER_REVIEW','APPROVED','CREDITED','REJECTED','PROOF_SUBMITTED','REQUIRES_MORE_INFORMATION','CANCELLED']).default(''),user:z.string().uuid().optional(),txid:z.string().regex(/^[a-fA-F0-9]{1,64}$/).optional(),from:z.string().date().optional(),to:z.string().date().optional(),minimum:money.optional(),maximum:money.optional()}).strict(),query);
    if(q.minimum&&q.maximum&&decimal(q.minimum,6)>decimal(q.maximum,6))throw new BadRequestException('Invalid amount range');
    const params=[q.status==='APPROVED'?'CREDITED':q.status,q.user??null,q.txid?.toLowerCase()??null,q.from??null,q.to??null,q.minimum??null,q.maximum??null];
    const where="($1='' OR d.status=$1) AND ($2::uuid IS NULL OR d.user_id=$2) AND ($3::text IS NULL OR d.tx_hash LIKE $3||'%') AND ($4::date IS NULL OR d.created_at>=($4::date::timestamp AT TIME ZONE 'Asia/Kolkata')) AND ($5::date IS NULL OR d.created_at<(($5::date+1)::timestamp AT TIME ZONE 'Asia/Kolkata')) AND ($6::numeric IS NULL OR d.submitted_amount>=$6) AND ($7::numeric IS NULL OR d.submitted_amount<=$7)";
    const rows=(await this.db.query(`SELECT d.*,u.public_user_id::text,u.email_ciphertext,u.mobile_ciphertext,p.full_name_ciphertext,(SELECT max(h.created_at) FROM manual_action_history h WHERE h.entity_id=d.id AND h.to_status IN ('CREDITED','REJECTED')) reviewed_at FROM manual_deposit_requests d JOIN users u ON u.id=d.user_id LEFT JOIN user_profiles p ON p.user_id=u.id WHERE ${where} ORDER BY d.created_at DESC,d.id LIMIT 50 OFFSET $8`,[...params,(q.page-1)*50])).rows;
    return {page:q.page,total:(await this.db.query(`SELECT count(*)::int total FROM manual_deposit_requests d WHERE ${where}`,params)).rows[0]!.total,rows:rows.map(r=>{const {email_ciphertext,mobile_ciphertext,full_name_ciphertext,...deposit}=r;const u=this.userView({id:r.user_id,email_ciphertext,mobile_ciphertext,full_name_ciphertext});return {...this.depositView(deposit),user_name:u.name,phone:u.mobile};})};
  }
  async deposit(actor: string, id: string) {
    await this.permission(actor, "DEPOSIT_REVIEW");
    await this.permission(actor, "users.read");
    const d = (
      await this.db.query("SELECT * FROM manual_deposit_requests WHERE id=$1", [
        id,
      ])
    ).rows[0];
    if (!d) throw new NotFoundException();
    const user = (
      await this.db.query(
        "SELECT u.id,u.public_user_id,u.status,u.admin_version,u.email_ciphertext,u.mobile_ciphertext,p.full_name_ciphertext FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id WHERE u.id=$1",
        [d.user_id],
      )
    ).rows[0];
    return {
      deposit: this.depositView(d),
      user: this.userView(user),
      proof: d.proof_id
        ? (
            await this.db.query(
              "SELECT id,mime,size_bytes,sha256,created_at FROM private_financial_files WHERE id=$1",
              [d.proof_id],
            )
          ).rows[0]
        : null,
      timeline: (
        await this.db.query(
          "SELECT actor_id,from_status,to_status,note,created_at FROM manual_action_history WHERE entity_id=$1 ORDER BY sequence",
          [id],
        )
      ).rows,
      amendments: (
        await this.db.query(
          "SELECT admin_id,before_values,after_values,reason,created_at FROM owner_deposit_amendments WHERE request_id=$1 ORDER BY created_at",
          [id],
        )
      ).rows,
      ledger: (
        await this.db.query(
          "SELECT id,event_key,event_type,created_at FROM ledger_journals WHERE source_id=$1",
          [id],
        )
      ).rows,
    };
  }
  async amendDeposit(actor: string, id: string, body: unknown) {
    await this.permission(actor, "deposits.amend");
    const b = parse(
      z
        .object({
          ...confirmation,
          submittedAmount: money,
          confirmedAmount: money.nullable(),
          txHash: z
            .string()
            .regex(/^[a-fA-F0-9]{64}$/)
            .transform((v) => v.toLowerCase()),
          note: text,
        })
        .strict(),
      body,
    );
    if (
      decimal(b.submittedAmount, 6) <= 0n ||
      (b.confirmedAmount !== null && decimal(b.confirmedAmount, 6) <= 0n)
    )
      throw new BadRequestException("Positive amounts required");
    return this.db.transaction(async (tx) => {
      const owner = (
        await tx.query(
          "SELECT user_id FROM manual_deposit_requests WHERE id=$1",
          [id],
        )
      ).rows[0];
      if (!owner) throw new NotFoundException();
      await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        owner.user_id,
      ]);
      const d = (
        await tx.query(
          "SELECT * FROM manual_deposit_requests WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0]!;
      if (d.status !== "UNDER_REVIEW" || d.admin_version !== b.version)
        throw new ConflictException(
          "Only unchanged pending reviews can be amended",
        );
      if (
        (
          await tx.query(
            "SELECT 1 FROM manual_deposit_txid_claims WHERE network_code=$1 AND tx_hash=$2 AND request_id<>$3 UNION ALL SELECT 1 FROM blockchain_transactions WHERE network_code=$1 AND tx_hash=$2",
            [d.network_code, b.txHash, id],
          )
        ).rows.length
      )
        throw new ConflictException("Transaction already used");
      const policy = d.policy_snapshot;
      if (!policy)
        throw new ConflictException("Review policy snapshot required");
      const day=(await tx.query("SELECT coalesce($1::date,($2::timestamptz AT TIME ZONE 'Asia/Kolkata')::date)::text AS limit_date",[d.limit_day,d.created_at])).rows[0]!.limit_date;
      await checkDepositLimits(tx,d.user_id,b.submittedAmount,policy,day,id);
      if(b.confirmedAmount!==null)await checkDepositLimits(tx,d.user_id,b.confirmedAmount,policy,day,id);
      const before = {
        txHash: d.tx_hash,
        submittedAmount: String(d.submitted_amount),
        confirmedAmount: d.verified_amount ? String(d.verified_amount) : null,
      };
      const after = {
        txHash: b.txHash,
        submittedAmount: b.submittedAmount,
        confirmedAmount: b.confirmedAmount,
      };
      await tx.query(
        "INSERT INTO owner_deposit_amendments(request_id,admin_id,before_values,after_values,reason) VALUES($1,$2,$3,$4,$5)",
        [id, actor, JSON.stringify(before), JSON.stringify(after), b.reason],
      );
      await tx.query(
        "UPDATE manual_deposit_requests SET tx_hash=$2,submitted_amount=$3,verified_amount=$4,updated_at=now() WHERE id=$1",
        [id, b.txHash, b.submittedAmount, b.confirmedAmount],
      );
      await tx.query(
        "INSERT INTO manual_action_history(entity_id,user_id,actor_id,from_status,to_status,note) VALUES($1,$2,$3,'UNDER_REVIEW','UNDER_REVIEW',$4)",
        [id, d.user_id, actor, b.note],
      );
      await this.audit(tx, actor, "owner.deposit.amended", id, {
        before,
        after,
        reason: b.reason,
      });
      return { saved: true, noCredit: true };
    });
  }
  async dashboard(actor: string) {
    await this.permission(actor, "dashboard.read");
    const counts = (
      await this.db.query(`SELECT
 (SELECT count(*)::text FROM users) total_users,(SELECT count(*)::text FROM users WHERE status='active') active_users,
 (SELECT count(*)::text FROM users WHERE created_at>=date_trunc('day',now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') registrations_today,
 (SELECT count(*)::text FROM manual_deposit_requests WHERE status IN ('UNDER_REVIEW','PROOF_SUBMITTED','REQUIRES_MORE_INFORMATION')) pending_deposits,
 (SELECT count(*)::text FROM manual_deposit_requests WHERE status='CREDITED') approved_deposits,
 (SELECT count(*)::text FROM manual_deposit_requests WHERE status='REJECTED') rejected_deposits,
 (SELECT count(*)::text FROM sell_orders WHERE status NOT IN ('completed','failed','cancelled','expired')) pending_sell_orders,
 (SELECT count(*)::text FROM payouts WHERE lifecycle IN ('QUEUED','SUBMITTED','PROCESSING')) pending_payouts,
 (SELECT count(*)::text FROM payouts WHERE lifecycle='SUCCESS') completed_payouts,
 (SELECT coalesce(sum(verified_amount),0)::text FROM manual_deposit_requests WHERE status='CREDITED' AND updated_at>=date_trunc('day',now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') manual_usdt_deposited_today,
 (SELECT coalesce(sum(q.amount_usdt),0)::text FROM sell_orders o JOIN quotes q ON q.id=o.quote_id WHERE o.status IN ('funded','payout_pending','payout_processing','completed') AND o.accepted_at>=date_trunc('day',now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') usdt_sold_today,
 (SELECT coalesce(sum(amount_inr_minor),0)::text FROM payouts WHERE lifecycle='SUCCESS') inr_paid_minor`)
    ).rows[0];
    return {
      counts,
      referralPolicy:(await this.db.query("SELECT value,version,updated_at FROM system_settings WHERE key='registration_referral_policy'")).rows[0]??null,
      rate:
        (
          await this.db.query(
            "SELECT version,manual_rate::text,mode,effective_from FROM rate_policies ORDER BY version DESC LIMIT 1",
          )
        ).rows[0] ?? null,
      wallet:
        (
          await this.db.query(
            "SELECT value,version FROM system_settings WHERE key='manual_deposit_wallet'",
          )
        ).rows[0] ?? null,
      release:
        (
          await this.db.query(
            "SELECT version_code,version_name,created_at FROM android_releases WHERE active",
          )
        ).rows[0] ?? null,
      maintenance: (await this.publicConfig()).maintenance,
    };
  }
  async reconciliation(actor:string){
    await this.permission(actor,'reconciliation.read');
    return {issues:(await this.db.query('SELECT * FROM reconciliation_issues ORDER BY detected_at DESC LIMIT 100')).rows,
      ledgerIntegrity:(await this.db.query('SELECT * FROM ledger_integrity_issues LIMIT 100')).rows,
      deposits:(await this.db.query("SELECT d.id,d.user_id,d.status,d.tx_hash,d.verified_amount,d.net_credited_amount,j.id AS journal_id,j.created_at AS credited_at,(d.status='CREDITED' AND j.id IS NULL) AS missing_credit FROM manual_deposit_requests d LEFT JOIN ledger_journals j ON j.source_id=d.id AND j.event_type='deposit' ORDER BY d.created_at DESC LIMIT 100")).rows,
      orders:(await this.db.query("SELECT o.id,o.user_id,o.status,p.id AS payout_id,p.lifecycle,p.utr,p.manual_receipt_id,j.id AS settlement_journal,(p.lifecycle='SUCCESS' AND (j.id IS NULL OR o.status<>'completed')) AS settlement_mismatch FROM sell_orders o LEFT JOIN payouts p ON p.order_id=o.id LEFT JOIN ledger_journals j ON j.event_key='payout:'||p.id::text ORDER BY o.accepted_at DESC LIMIT 100")).rows,
      note:'Read-only relationships. No automatic correction or financial execution.'};
  }
  async admins(actor: string) {
    await this.permission(actor, "admins.read");
    return (
      await this.db.query(
        "SELECT u.id,u.status,(u.totp_secret_ciphertext IS NOT NULL) AS mfa_enrolled,r.name AS role,p.permission_code FROM admin_users u LEFT JOIN admin_user_roles a ON a.admin_user_id=u.id LEFT JOIN admin_roles r ON r.id=a.role_id LEFT JOIN admin_role_permissions p ON p.role_id=r.id ORDER BY u.id,r.name,p.permission_code",
      )
    ).rows;
  }

  async health(actor: string) {
    await this.permission(actor, "system.monitor");
    let readiness: unknown;
    try {
      readiness = await new HealthController(this.db).ready();
    } catch {
      readiness = {
        status: "unavailable",
        database: (await this.db.ready()) ? "ready" : "unavailable",
      };
    }
    const endpoints = await Promise.all(
      ["https://dtexchange.app", "https://admin.dtexchange.app"].map(
        async (url) => {
          try {
            const r = await fetch(url, {
              method: "HEAD",
              signal: AbortSignal.timeout(5000),
            });
            return {
              url,
              status: r.status,
              httpsValidated: true,
              checkedAt: new Date().toISOString(),
            };
          } catch {
            return {
              url,
              status: null,
              httpsValidated: false,
              checkedAt: new Date().toISOString(),
            };
          }
        },
      ),
    );
    let disk: unknown = { status: "unavailable" };
    try {
      const d = await statfs("/", { bigint: true });
      disk = {
        totalBytes: (d.blocks * d.bsize).toString(),
        availableBytes: (d.bavail * d.bsize).toString(),
      };
    } catch {}
    let backup: unknown = { status: "not_reported" };
    if (process.env.OWNER_HEALTH_REPORT_FILE)
      try {
        const parsed = JSON.parse(
          await readFile(process.env.OWNER_HEALTH_REPORT_FILE, "utf-8"),
        );
        backup = {
          status: ["healthy", "failed", "stale"].includes(parsed.backupStatus)
            ? parsed.backupStatus
            : "unknown",
          lastSuccessfulBackup:
            typeof parsed.lastSuccessfulBackup === "string"
              ? parsed.lastSuccessfulBackup
              : null,
          checkedAt:
            typeof parsed.checkedAt === "string" ? parsed.checkedAt : null,
        };
      } catch {}
    return {
      readiness,
      endpoints,
      disk,
      backup,
      logging: await localLoggingHealth(process.env.OWNER_HEALTH_REPORT_FILE),
      workers: (
        await this.db.query(
          "SELECT worker,state,last_seen_at FROM worker_heartbeats ORDER BY worker",
        )
      ).rows,
    };
  }
}

import {checkDepositLimits} from "./deposit-limits";
import { verifyDepositOnChain } from "./chain-verification";
import { syntheticValidation } from '../../common/synthetic-validation';
import { privateBetaEnabled, requirePrivateBetaAccount, PRIVATE_BETA_ADDRESS } from '../../common/private-beta';
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { randomUUID, createHash, verify, createPublicKey } from "node:crypto";
import { z } from "zod";
import { DatabaseService, SqlClient } from "../../common/database.service";
import { CryptoService } from "../../common/crypto.service";
import { SecurityService } from "../../common/security.service";
import { LedgerService } from "../ledger/ledger.service";
import { OrderTransitionService } from "../orders/order-transition.service";
import { decimal, format, databaseUnits, calculateRate } from "../rates/money";
import { payoutConfig } from "../payouts/payout.provider";
import { chainConfig } from "../blockchain/chain.config";
import { validTronAddress } from "../blockchain/tron-address";
import {
  requireManual,
  manualDeposits,
  manualDepositSubmissions,
  manualPayouts,
  selfDeclaredManualBanks,
} from "../../config/manual-mode";
import { NotificationService } from "../notifications/notification.service";
const amount = z.string().regex(/^\d{1,12}(\.\d{1,6})?$/),
  hash = z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/)
    .transform((s) => s.toLowerCase()),
  note = z.string().min(10).max(1000);
export function input(schema: z.ZodType, b: unknown): any {
  const r = schema.safeParse(b);
  if (!r.success)
    throw new BadRequestException("Invalid or missing required information");
  return r.data;
}
@Injectable()
export class ManualService {
  constructor(
    private db: DatabaseService,
    private crypto: CryptoService,
    private security: SecurityService,
    private ledger: LedgerService,
    private transitions: OrderTransitionService,
    private notifications: NotificationService,
  ) {}
  async permission(admin: string, code: string, tx: SqlClient = this.db) {
    if (
      !(
        await tx.query(
          "SELECT 1 FROM admin_user_roles u JOIN admin_role_permissions p ON p.role_id=u.role_id WHERE u.admin_user_id=$1 AND p.permission_code=$2",
          [admin, code],
        )
      ).rows.length
    )
      throw new ForbiddenException();
  }
  async gate(tx: SqlClient, flag: string, uid?: string, evidenceOnly = false) {
    if (privateBetaEnabled()) {
      if (flag !== 'deposits' || !evidenceOnly) throw new ConflictException('Service temporarily paused');
      await requirePrivateBetaAccount(tx, uid);
    }
    const r = (
      await tx.query(
        "SELECT value FROM system_settings WHERE key='operational_controls' FOR SHARE",
      )
    ).rows[0];
    if (!r || r.value.mode !== "NORMAL" || r.value[flag] !== true || (flag === "payouts" && process.env.PAYOUTS_ENABLED !== "true") || (flag === "deposits" && process.env.TRANSACTIONS_ENABLED !== "true" && !(evidenceOnly && manualDepositSubmissions()) && !(await syntheticValidation(tx, uid))))
      throw new ConflictException("Service temporarily paused");
  }
  async eligible(tx: SqlClient, uid: string) {
    const u = (
      await tx.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [uid])
    ).rows[0];
    if (u?.status !== "active")
      throw new ForbiddenException("Active account required");
    if (process.env.NODE_ENV === "production" && u.verification_status !== "verified")
      throw new ForbiddenException("Verified account required");
    if (
      (
        await tx.query(
          "SELECT 1 FROM risk_flags WHERE user_id=$1 AND severity IN ('high','critical') AND state<>'resolved'",
          [uid],
        )
      ).rows.length
    )
      throw new ConflictException("Account requires review");
  }
  async event(
    tx: SqlClient,
    actor: string,
    uid: string,
    id: string,
    from: string | null,
    to: string,
    reason: string,
    admin = true,
  ) {
    await tx.query(
      "INSERT INTO manual_action_history(entity_id,user_id,actor_id,from_status,to_status,note) VALUES($1,$2,$3,$4,$5,$6)",
      [id, uid, actor, from, to, reason],
    );
    await tx.query(
      "INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES($1,$2,'manual.transition','manual',$3,$4,$5)",
      [
        admin ? "admin" : "user",
        actor,
        id,
        randomUUID(),
        JSON.stringify({ userId: uid, from, to, reason }),
      ],
    );
    await this.notifications.create(
      tx,
      uid,
      "manual:" + id + ":" + to + ":" + randomUUID(),
      to.includes("DEPOSIT") ||
        [
          "PROOF_SUBMITTED",
          "UNDER_REVIEW",
          "APPROVED",
          "REJECTED",
          "CREDITED",
          "REQUIRES_MORE_INFORMATION",
        ].includes(to)
        ? "DEPOSIT"
        : "PAYOUT",
      to.replaceAll("_", " "),
      reason,
      "/history",
    );
  }
  async depositPolicy(tx: SqlClient = this.db) {
    const row=(await tx.query("SELECT value,version FROM system_settings WHERE key='manual_deposit_policy' FOR SHARE")).rows[0];
    if (!row) throw new ConflictException('Deposit policy not configured');
    const v=row.value;
    if (!v || typeof v.minimumDeposit !== 'string' || typeof v.dailyDepositLimit !== 'string' || !amount.safeParse(v.minimumDeposit).success || !amount.safeParse(v.dailyDepositLimit).success || decimal(v.minimumDeposit,6)<=0n || decimal(v.dailyDepositLimit,6)<decimal(v.minimumDeposit,6)) throw new ConflictException('Invalid deposit policy');
    const fee=v.depositFeeUsdt??'0',monthly=v.monthlyLimitEnabled===true;
    if(!amount.safeParse(fee).success||decimal(fee,6)>=decimal(v.minimumDeposit,6)|| (monthly&&(!amount.safeParse(v.monthlyDepositLimit).success||decimal(v.monthlyDepositLimit,6)<decimal(v.minimumDeposit,6))))throw new ConflictException('Invalid deposit fee or monthly limit');
    return {minimumDeposit:v.minimumDeposit,dailyDepositLimit:v.dailyDepositLimit,depositFeeUsdt:fee,monthlyDepositLimit:monthly?v.monthlyDepositLimit:null,monthlyLimitEnabled:monthly,timezone:'Asia/Kolkata',version:row.version};
  }
  async depositUsage(tx: SqlClient, uid: string, day: string, exclude: string | null = null) {
    return (await tx.query(`SELECT coalesce(sum(coalesce(verified_amount,submitted_amount)),0)::text used FROM manual_deposit_requests WHERE user_id=$1 AND coalesce(limit_day,(created_at AT TIME ZONE 'Asia/Kolkata')::date)=$2::date AND status NOT IN ('REJECTED','CANCELLED') AND ($3::uuid IS NULL OR id<>$3::uuid)`,[uid,day,exclude])).rows[0]!.used as string;
  }
  async checkDepositLimit(tx: SqlClient, uid: string, value: string, policy: any, day: string, exclude: string | null = null) {
    return checkDepositLimits(tx,uid,value,policy,day,exclude);
  }
  async depositRateSnapshot(tx:SqlClient){
    const row=(await tx.query("SELECT id,version,manual_rate::text,spread_bps,effective_from FROM rate_policies WHERE mode='manual' AND effective_from<=now() AND (retired_at IS NULL OR retired_at>now()) ORDER BY version DESC LIMIT 1")).rows[0];
    if(!row)return null;
    const rate=format(calculateRate(0n,'manual',databaseUnits(row.manual_rate,8),0,row.spread_bps),8);
    return {source:'MANUAL_ADMIN',rateInr:rate,policyId:row.id,policyVersion:row.version,effectiveAt:row.effective_from,capturedAt:new Date().toISOString()};
  }
  async publicTerms() {
    const p=(await this.db.query("SELECT p.manual_rate::text,p.minimum_sell::text,p.maximum_sell::text,p.effective_from,p.mode,p.spread_bps,f.basis_points,f.flat_inr_minor::text FROM rate_policies p JOIN fees f ON f.id=p.fee_id WHERE p.effective_from<=now() AND (p.retired_at IS NULL OR p.retired_at>now()) AND f.effective_from<=now() AND (f.retired_at IS NULL OR f.retired_at>now()) ORDER BY p.version DESC LIMIT 1")).rows[0];
    const deposit=await this.depositPolicy();
    return {source:p?.mode==='manual'?'MANUAL_ADMIN':null,rate:p?.mode==='manual'?format(calculateRate(0n,'manual',databaseUnits(p.manual_rate,8),0,p.spread_bps),8):null,sellFeeBasisPoints:p?.basis_points??null,sellFlatFeeInrMinor:p?.flat_inr_minor??null,minimumSell:p?.minimum_sell??null,maximumSell:p?.maximum_sell??null,rateLastUpdatedAt:p?.effective_from??null,...deposit};
  }
  async configuration(uid?: string) {
    const beta = privateBetaEnabled() && uid !== undefined;
    if (beta) await requirePrivateBetaAccount(this.db, uid);
    // Reading manual wallet configuration must not require an automatic-chain adapter.
    const sandbox = process.env.NODE_ENV !== 'production' && (process.env.TRON_PROVIDER ?? 'mock') === 'mock';
    const setting=(await this.db.query("SELECT value,version FROM system_settings WHERE key='manual_deposit_wallet'")).rows[0];
    const address=setting?.value?.address ?? process.env.MANUAL_COLLECTION_ADDRESS ?? null;
    if (address && !sandbox && !validTronAddress(address)) throw new ConflictException('Invalid configured TRC20 address');
    const controls=(await this.db.query("SELECT value FROM system_settings WHERE key='operational_controls'")).rows[0]?.value;
    const enabled=(process.env.TRANSACTIONS_ENABLED==='true'||manualDepositSubmissions()||await syntheticValidation(this.db,uid))&&controls?.mode==='NORMAL'&&controls?.deposits===true;
    const policyRow=(await this.db.query("SELECT value FROM system_settings WHERE key='manual_deposit_policy'")).rows[0];
    return {
      minimumDeposit:policyRow?.value?.minimumDeposit ?? null,
      dailyDepositLimit:policyRow?.value?.dailyDepositLimit ?? null,
      depositLimitTimezone:'Asia/Kolkata',
      depositFeeUsdt:policyRow?.value?.depositFeeUsdt??'0',
      monthlyDepositLimit:policyRow?.value?.monthlyLimitEnabled===true?policyRow.value.monthlyDepositLimit:null,
      monthlyLimitEnabled:policyRow?.value?.monthlyLimitEnabled===true,
      monthlyDepositLimitEnabled:policyRow?.value?.monthlyLimitEnabled===true,
      manualDepositReview: manualDeposits(),
      manualPayout: manualPayouts(),
      network: "TRC20",
      chainNetwork: sandbox ? 'tron-mock' : 'tron-mainnet',
      asset: 'USDT',
      address: beta ? PRIVATE_BETA_ADDRESS : address,
      depositsEnabled: enabled,
      sandbox: beta || sandbox,
      walletVersion: setting?.version ?? 0,
    };
  }
  async depositWallet(actor: string) {
    await this.permission(actor,'settings.read');
    return this.configuration();
  }
  async readDepositPolicy(actor: string) {
    await this.permission(actor,'settings.read');
    return this.depositPolicy();
  }
  async updateDepositPolicy(actor: string, body: unknown) {
    await this.permission(actor,'settings.write');
    const b=input(z.object({minimumDeposit:amount,dailyDepositLimit:amount,depositFeeUsdt:amount.default('0'),monthlyDepositLimit:amount.nullable(),monthlyLimitEnabled:z.boolean(),version:z.number().int().min(0),reason:z.string().trim().min(10).max(500)}).strict(),body);
    if(decimal(b.minimumDeposit,6)<=0n || decimal(b.dailyDepositLimit,6)<decimal(b.minimumDeposit,6)) throw new BadRequestException('Invalid deposit limits');
    if(decimal(b.depositFeeUsdt,6)>=decimal(b.minimumDeposit,6)|| (b.monthlyLimitEnabled?(b.monthlyDepositLimit===null||decimal(b.monthlyDepositLimit,6)<decimal(b.minimumDeposit,6)):b.monthlyDepositLimit!==null))throw new BadRequestException('Invalid deposit fee or monthly cap');
    return this.db.transaction(async tx=>{
      await tx.query('SELECT pg_advisory_xact_lock(74120013)');
      const previous=(await tx.query("SELECT value,version FROM system_settings WHERE key='manual_deposit_policy' FOR UPDATE")).rows[0];
      if((previous?.version??0)!==b.version) throw new ConflictException('Deposit policy changed');
      const value={minimumDeposit:b.minimumDeposit,dailyDepositLimit:b.dailyDepositLimit,monthlyDepositLimit:b.monthlyDepositLimit,monthlyLimitEnabled:b.monthlyLimitEnabled,depositFeeUsdt:b.depositFeeUsdt,timezone:'Asia/Kolkata'};
      await tx.query("INSERT INTO system_settings(key,value,version,updated_by) VALUES('manual_deposit_policy',$1,1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value,version=system_settings.version+1,updated_by=excluded.updated_by,updated_at=now()",[JSON.stringify(value),actor]);
      await tx.query("INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES('admin',$1,'manual.deposit_policy.changed','settings','manual_deposit_policy',gen_random_uuid(),$2)",[actor,JSON.stringify({before:previous?.value??null,after:value,reason:b.reason})]);
      return {saved:true,version:b.version+1};
    });
  }
  async updateDepositWallet(actor: string, body: unknown) {
    await this.permission(actor,'settings.write');
    const b=input(z.object({address:z.string().refine(validTronAddress),network:z.literal('TRC20'),asset:z.literal('USDT'),confirmAddress:z.string(),version:z.number().int().min(0),reason:z.string().trim().min(10).max(500)}).strict(),body);
    if(b.address!==b.confirmAddress) throw new BadRequestException('Confirm the exact deposit address');
    return this.db.transaction(async tx=>{
      await tx.query('SELECT pg_advisory_xact_lock(74120012)');
      const old=(await tx.query("SELECT value,version FROM system_settings WHERE key='manual_deposit_wallet' FOR UPDATE")).rows[0];
      if((old?.version??0)!==b.version) throw new ConflictException('Deposit wallet configuration changed');
      const value={address:b.address,network:'TRC20',asset:'USDT'};
      await tx.query("INSERT INTO system_settings(key,value,version,updated_by) VALUES('manual_deposit_wallet',$1,1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value,version=system_settings.version+1,updated_by=excluded.updated_by,updated_at=now()",[JSON.stringify(value),actor]);
      await tx.query("INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES('admin',$1,'manual.deposit_wallet.changed','settings','manual_deposit_wallet',gen_random_uuid(),$2)",[actor,JSON.stringify({before:old?.value??null,after:value,reason:b.reason})]);
      return {saved:true,version:b.version+1};
    });
  }
  async upload(actor: string, admin: boolean, file: any, purpose: string) {
    if (
      !["proof", "receipt"].includes(purpose) ||
      !file?.buffer ||
      file.buffer.length > 5242880 ||
      file.buffer.length < 8
    )
      throw new BadRequestException("JPG, PNG or PDF up to 5 MB required");
    if (admin)
      await this.permission(
        actor,
        purpose === "receipt" ? "PAYOUT_CONFIRM" : "DEPOSIT_REVIEW",
      );
    else if (purpose !== "proof") throw new ForbiddenException();
    const b: Buffer = file.buffer;
    const mime = b
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? "image/png"
      : b[0] === 255 && b[1] === 216 && b[2] === 255
        ? "image/jpeg"
        : b.subarray(0, 5).toString() === "%PDF-"
          ? "application/pdf"
          : null;
    if (!mime || file.mimetype !== mime)
      throw new BadRequestException("Unsupported file content");
    await this.security.limit("manual-upload:" + actor, 12, 3600);
    const id = randomUUID();
    await this.db.query(
      "INSERT INTO private_financial_files(id,user_id,admin_id,purpose,mime,size_bytes,sha256,payload_ciphertext) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        id,
        admin ? null : actor,
        admin ? actor : null,
        purpose,
        mime,
        b.length,
        createHash("sha256").update(b).digest("hex"),
        this.crypto.encrypt(b.toString("base64"), "financial-file:" + id),
      ],
    );
    return { id, mime, sizeBytes: b.length };
  }
  async file(actor: string, admin: boolean, id: string) {
    const f = (
      await this.db.query("SELECT * FROM private_financial_files WHERE id=$1", [
        id,
      ])
    ).rows[0];
    if (!f) throw new NotFoundException();
    if (admin) {
      await this.permission(
        actor,
        f.purpose === "proof" ? "DEPOSIT_REVIEW" : "PAYOUT_VIEW",
      );
    } else if (
      f.user_id !== actor &&
      !(
        await this.db.query(
          "SELECT id FROM payouts WHERE user_id=$1 AND manual_receipt_id=$2",
          [actor, id],
        )
      ).rows.length
    )
      throw new NotFoundException();
    await this.db.query(
      "INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES($1,$2,'manual.file_read','private_file',$3,$4,'{}')",
      [admin ? "admin" : "user", actor, id, randomUUID()],
    );
    return {
      id,
      mime: f.mime,
      base64: this.crypto.decrypt(f.payload_ciphertext, "financial-file:" + id),
      sha256: f.sha256,
    };
  }
  async submit(uid: string, body: unknown, key?: string) {
    requireManual("deposit");
    const isolatedDemo = process.env.PUBLIC_TEST_MODE === 'true';
    if (isolatedDemo) (await import('../../public-test/isolation.js')).assertPublicTestIsolation();
    if (!isolatedDemo && body && typeof body === 'object' && !('proofId' in body))
      throw new BadRequestException('Deposit proof required');
    const b = input(
      z
        .object({
          amountUsdt: amount,
          network: z.literal("TRC20"),
          txHash: hash,
          sender: z.string().max(100).optional(),
          transactionTime: z.string().datetime().optional(),
          proofId: isolatedDemo ? z.string().uuid().optional() : z.string().uuid(),
          note: z.string().max(1000).default(""),
        })
        .strict(),
      body,
    );
    if (decimal(b.amountUsdt, 6) <= 0n) throw new BadRequestException();
    const c = await this.configuration(uid);
    if (!c.address)
      throw new ConflictException("Deposit address not configured");
    return this.security.idempotent(uid, "manual.proof", key, b, async (tx) => {
      await this.gate(tx, "deposits", uid, true);
      await this.eligible(tx, uid);
      const policy=await this.depositPolicy(tx);
      const synthetic=await syntheticValidation(tx,uid);
      if (privateBetaEnabled() && !synthetic) throw new ConflictException('Service temporarily paused');
      const day=(await tx.query("SELECT to_char(now() AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS limit_date")).rows[0]!.limit_date;
      await this.checkDepositLimit(tx,uid,b.amountUsdt,policy,day);
      if (
        b.proofId &&
        !(
          await tx.query(
            "SELECT id FROM private_financial_files WHERE id=$1 AND user_id=$2 AND purpose='proof'",
            [b.proofId, uid],
          )
        ).rows.length
      )
        throw new NotFoundException("Proof unavailable");
      if (
        (
          await tx.query(
            "SELECT request_id AS id FROM manual_deposit_txid_claims WHERE network_code=$1 AND tx_hash=$2",
            [c.chainNetwork, b.txHash],
          )
        ).rows.length ||
        (
          await tx.query("SELECT id FROM ledger_journals WHERE event_key=$1", [
            "deposit:" + c.chainNetwork + ":" + b.txHash,
          ])
        ).rows.length
      )
        throw new ConflictException(
          "Transaction already submitted or credited",
        );
      const p = (
        await tx.query(
          "INSERT INTO manual_deposit_requests(user_id,network_code,tx_hash,submitted_amount,receiver,sender,transaction_time,proof_id,note,policy_snapshot,limit_day,rate_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *",
          [
            uid,
            c.chainNetwork,
            b.txHash,
            b.amountUsdt,
            c.address,
            b.sender ?? null,
            b.transactionTime ?? null,
            b.proofId ?? null,
            synthetic ? "TEST/SYNTHETIC - NON-CREDITABLE physical validation" : b.note,
            JSON.stringify({...policy,...(synthetic?{synthetic:true}: {})}),
            day,
            JSON.stringify(await this.depositRateSnapshot(tx)),
          ],
        )
      ).rows[0]!;
      await tx.query("UPDATE manual_deposit_requests SET status='UNDER_REVIEW' WHERE id=$1",[p.id]);
      p.status='UNDER_REVIEW';
      await this.event(
        tx,
        uid,
        uid,
        p.id,
        null,
        "UNDER_REVIEW",
        synthetic ? "TEST/SYNTHETIC - no blockchain confirmation; credit prohibited" : "Deposit proof submitted; no balance credited",
        false,
      );
      return p;
    });
  }
  async resubmit(uid: string, id: string, body: unknown) {
    requireManual("deposit");
    const b = input(
      z.object({ proofId: z.string().uuid(), note }).strict(),
      body,
    );
    return this.db.transaction(async (tx) => {
      await this.gate(tx, "deposits", uid, true);
      await this.eligible(tx, uid);
      const p = (
        await tx.query(
          "SELECT * FROM manual_deposit_requests WHERE id=$1 AND user_id=$2 FOR UPDATE",
          [id, uid],
        )
      ).rows[0];
      if (!p) throw new NotFoundException();
      if (privateBetaEnabled() && p.policy_snapshot?.synthetic !== true) throw new ForbiddenException();
      if (!["REQUIRES_MORE_INFORMATION", "REJECTED"].includes(p.status))
        throw new ConflictException();
      if (
        !(
          await tx.query(
            "SELECT 1 FROM private_financial_files WHERE id=$1 AND user_id=$2 AND purpose='proof'",
            [b.proofId, uid],
          )
        ).rows.length
      )
        throw new NotFoundException();
      const policy=await this.depositPolicy(tx);
      const synthetic=await syntheticValidation(tx,uid);
      const day=(await tx.query("SELECT to_char(now() AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS limit_date")).rows[0]!.limit_date;
      await this.checkDepositLimit(tx,uid,String(p.submitted_amount),policy,day,id);
      await tx.query(
        "UPDATE manual_deposit_requests SET policy_snapshot=$4,limit_day=$5,proof_id=$2,note=$3,status='PROOF_SUBMITTED',updated_at=now() WHERE id=$1",
        [id, b.proofId, b.note, JSON.stringify(p.policy_snapshot??{...policy,...(synthetic?{synthetic:true}:{})}),day],
      );
      await this.event(
        tx,
        uid,
        uid,
        id,
        p.status,
        "PROOF_SUBMITTED",
        b.note,
        false,
      );
      return { status: "PROOF_SUBMITTED" };
    });
  }
  async deposits(actor: string, admin = false, page = 1, id:string|null=null) {
    if (admin) await this.permission(actor, "DEPOSIT_REVIEW");
    if(!admin)return (await this.db.query('SELECT * FROM manual_deposit_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50 OFFSET $2',[actor,(page-1)*50])).rows;
    return (await this.db.query(`SELECT d.*,u.public_user_id::text,
      (SELECT coalesce(sum(coalesce(x.verified_amount,x.submitted_amount)),0)::text FROM manual_deposit_requests x WHERE x.user_id=d.user_id AND coalesce(x.limit_day,(x.created_at AT TIME ZONE 'Asia/Kolkata')::date)=coalesce(d.limit_day,(d.created_at AT TIME ZONE 'Asia/Kolkata')::date) AND x.status NOT IN ('REJECTED','CANCELLED')) daily_deposit_usage,
      coalesce((SELECT jsonb_agg(jsonb_build_object('from_status',h.from_status,'to_status',h.to_status,'note',h.note,'created_at',h.created_at) ORDER BY h.sequence) FROM manual_action_history h WHERE h.entity_id=d.id),'[]'::jsonb) timeline
      FROM manual_deposit_requests d JOIN users u ON u.id=d.user_id WHERE ($2::uuid IS NULL OR d.id=$2) ORDER BY d.created_at DESC,d.id LIMIT 50 OFFSET $1`,[(page-1)*50,id])).rows;
  }
  async detail(uid: string, id: string) {
    const p = (
      await this.db.query(
        "SELECT * FROM manual_deposit_requests WHERE id=$1 AND user_id=$2",
        [id, uid],
      )
    ).rows[0];
    if (!p) throw new NotFoundException();
    return {
      ...p,
      timeline: (
        await this.db.query(
          "SELECT from_status,to_status,note,created_at FROM manual_action_history WHERE entity_id=$1 ORDER BY sequence",
          [id],
        )
      ).rows,
    };
  }
  async review(admin: string, id: string, body: unknown) {
    requireManual("deposit");
    const b = input(
      z
        .object({
          action: z.enum(["start", "reject", "information", "approve"]),
          note,
          verifiedAmount: amount.optional(),
          txHash: hash.optional(),
          receiver: z.string().max(100).optional(),
          contract: z.string().max(100).optional(),
          sender: z.string().max(100).optional(),
          blockNumber: z
            .string()
            .regex(/^\d{1,16}$/)
            .optional(),
          blockHash: hash.optional(),
          confirmations: z.number().int().min(1).max(100000).optional(),
          transactionTime: z.string().datetime().optional(),
          chainSucceeded: z.literal(true).optional(),
        })
        .strict(),
      body,
    );
    await this.permission(
      admin,
      b.action === "approve" ? "DEPOSIT_APPROVE" : "DEPOSIT_REVIEW",
    );
    return this.db.transaction(async (tx) => {
      const owner=(await tx.query('SELECT user_id FROM manual_deposit_requests WHERE id=$1',[id])).rows[0];
      if (!owner) throw new NotFoundException();
      await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[owner.user_id]);
      const p = (
        await tx.query(
          "SELECT * FROM manual_deposit_requests WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!p) throw new NotFoundException();
      if (p.policy_snapshot?.synthetic === true && b.action === "approve") throw new ForbiddenException("Synthetic deposits cannot be credited");
      if (p.status === "CREDITED") {
        if (b.action === "approve")
          return { status: "CREDITED", duplicate: true };
        throw new ConflictException();
      }
      if (b.action === "approve") {
        if (p.status !== "UNDER_REVIEW" || !p.reviewer_id)
          throw new ConflictException("Start review before approval");
        const c = chainConfig();
        if (
          !b.verifiedAmount ||
          decimal(b.verifiedAmount, 6) !==
            decimal(String(p.submitted_amount), 6) ||
          b.txHash !== p.tx_hash ||
          b.receiver !== p.receiver ||
          b.contract !== c.contract ||
          p.network_code !== c.network ||
          !b.sender ||
          !b.blockNumber ||
          !b.blockHash ||
          !b.transactionTime ||
          !b.chainSucceeded ||
          !b.confirmations ||
          b.confirmations < c.confirmations
        )
          throw new BadRequestException(
            "Complete matching blockchain verification required",
          );
        if (new Date(b.transactionTime!).getTime() > Date.now())
          throw new BadRequestException(
            "Future blockchain transaction time rejected",
          );
        const token = (
          await tx.query(
            "SELECT 1 FROM token_contracts t JOIN networks n ON n.code=t.network_code WHERE t.network_code=$1 AND t.asset_symbol='USDT' AND t.contract_address=$2 AND t.enabled AND n.enabled AND n.required_confirmations=$3",
            [c.network, c.contract, c.confirmations],
          )
        ).rows[0];
        if (!token)
          throw new ConflictException(
            "Provisioned chain configuration required",
          );
        await this.eligible(tx, p.user_id);
        await this.gate(tx, "deposits");
        // Real networks require read-only RPC corroboration in addition to admin review.
        // Isolated mock-network tests retain their separate evidence path.
        const chainEvidence = c.sandbox ? null : await verifyDepositOnChain(b, c);
        const policy=p.policy_snapshot ?? await this.depositPolicy(tx);
        const day=(await tx.query("SELECT to_char(coalesce($1::date,($2::timestamptz AT TIME ZONE 'Asia/Kolkata')::date),'YYYY-MM-DD') AS limit_date",[p.limit_day,p.created_at])).rows[0]!.limit_date;
        await this.checkDepositLimit(tx,p.user_id,b.verifiedAmount,policy,day,id);
        if (
          (
            await tx.query(
              "SELECT id FROM blockchain_transactions WHERE network_code=$1 AND tx_hash=$2",
              [p.network_code, p.tx_hash],
            )
          ).rows.length
        )
          throw new ConflictException("Transaction already used");
        await tx.query(
          "INSERT INTO blockchain_transactions(network_code,tx_hash,event_index,asset_symbol,contract_address,sender,receiver,raw_amount,amount,block_number,block_hash,confirmations,required_confirmations,status,block_timestamp,confirmed_at) VALUES($1,$2,$13,'USDT',$3,$4,$5,$6,$7,$8,$9,$10,$11,'confirmed',$12,now())",
          [
            p.network_code,
            p.tx_hash,
            b.contract,
            b.sender,
            p.receiver,
            decimal(b.verifiedAmount, 6).toString(),
            b.verifiedAmount,
            b.blockNumber,
            b.blockHash,
            chainEvidence?.confirmations ?? b.confirmations,
            c.confirmations,
            b.transactionTime,
            chainEvidence?.eventIndex ?? 0,
          ],
        );
        await tx.query(
          "INSERT INTO wallets(user_id,asset_symbol,status) VALUES($1,'USDT','active') ON CONFLICT(user_id,asset_symbol) DO NOTHING",
          [p.user_id],
        );
        const posted = await this.ledger.deposit(tx, {
          id: p.id,
          user_id: p.user_id,
          network_code: p.network_code,
          tx_hash: p.tx_hash,
          amount: b.verifiedAmount,
          fee: policy.depositFeeUsdt??'0',
        });
        if (!posted)
          throw new ConflictException("Transaction already credited");
        await this.event(
          tx,
          admin,
          p.user_id,
          id,
          p.status,
          "APPROVED",
          b.note,
        );
        await tx.query(
          "UPDATE manual_deposit_requests SET status='CREDITED',net_credited_amount=$6,deposit_fee_amount=$7,verified_amount=$2,reviewer_id=$3,verification=$4,reason=$5,updated_at=now() WHERE id=$1",
          [id, b.verifiedAmount, admin, JSON.stringify({...b, ...(chainEvidence ? {independentChain: chainEvidence} : {})}), b.note,format(decimal(b.verifiedAmount,6)-decimal(policy.depositFeeUsdt??'0',6),6),policy.depositFeeUsdt??'0'],
        );
        await this.event(
          tx,
          admin,
          p.user_id,
          id,
          "APPROVED",
          "CREDITED",
          "Verified USDT credited to your wallet",
        );
        return { status: "CREDITED" };
      }
      const to =
        b.action === "start"
          ? "UNDER_REVIEW"
          : b.action === "reject"
            ? "REJECTED"
            : "REQUIRES_MORE_INFORMATION";
      if (!["PROOF_SUBMITTED", "UNDER_REVIEW"].includes(p.status))
        throw new ConflictException("Review not available");
      await tx.query(
        "UPDATE manual_deposit_requests SET status=$2,reviewer_id=$3,reason=$4,updated_at=now() WHERE id=$1",
        [id, to, admin, b.note],
      );
      await this.event(tx, admin, p.user_id, id, p.status, to, b.note);
      return { status: to };
    });
  }
  async adminBankAccounts(admin: string, userId: string) {
    await this.permission(admin, "PAYOUT_VIEW");
    const result = await this.db.query(
      "SELECT b.id,b.user_id,b.bank_name,b.ifsc,b.branch,b.last_four,b.account_number_ciphertext,b.holder_name_ciphertext,b.verification_status,b.is_default,b.self_declared,b.created_at,u.public_user_id FROM bank_accounts b JOIN users u ON u.id=b.user_id WHERE b.user_id=$1 AND b.disabled_at IS NULL ORDER BY b.created_at DESC LIMIT 50",
      [userId],
    );
    return result.rows.map((b) => ({
      id: b.id,
      userId: b.user_id,
      publicUserId: String(b.public_user_id),
      bankName: b.bank_name,
      ifsc: b.ifsc,
      branch: b.branch,
      accountNumber: this.crypto.decrypt(b.account_number_ciphertext, b.id + ":number"),
      accountHolderName: this.crypto.decrypt(b.holder_name_ciphertext, b.id + ":holder"),
      verificationStatus: b.verification_status,
      selfDeclared: b.self_declared,
      isDefault: b.is_default,
      createdAt: b.created_at,
    }));
  }
  async payoutList(admin: string, page = 1, id:string|null=null) {
    await this.permission(admin, "PAYOUT_VIEW");
    return (
      await this.db.query(
        "SELECT o.id,o.user_id,u.public_user_id::text,o.status,o.review_reason,q.amount_usdt,q.rate_inr,q.fee_inr_minor::text,q.net_inr_minor::text,b.bank_name,b.last_four,b.ifsc,p.id payout_id,p.lifecycle,p.utr,p.manual_receipt_id,p.created_at AS payout_created_at,p.processed_at,p.manual_paid_at,p.failure_reason,q.created_at AS quote_created_at,q.expires_at AS quote_expires_at,o.accepted_at,o.completed_at,b.id AS bank_account_id FROM sell_orders o JOIN users u ON u.id=o.user_id JOIN quotes q ON q.id=o.quote_id JOIN bank_accounts b ON b.id=o.bank_account_id LEFT JOIN payouts p ON p.order_id=o.id WHERE o.funding_source='wallet' AND o.status IN ('payout_pending','payout_processing','completed','failed','review') AND ($2::uuid IS NULL OR o.id=$2 OR p.id=$2) ORDER BY o.accepted_at DESC LIMIT 50 OFFSET $1",
        [(page - 1) * 50,id],
      )
    ).rows;
  }
  async process(admin: string, id: string, body: unknown) {
    requireManual("payout");
    const b = input(
      z
        .object({
          note,
          method: z.enum(["IMPS", "NEFT", "RTGS"]).default("IMPS"),
        })
        .strict(),
      body,
    );
    await this.permission(admin, "PAYOUT_PROCESS");
    return this.db.transaction(async (tx) => {
      await this.gate(tx, "payouts");
      const owner = (
        await tx.query("SELECT user_id FROM sell_orders WHERE id=$1", [id])
      ).rows[0];
      if (!owner) throw new NotFoundException();
      await this.eligible(tx, owner.user_id);
      const o = (
        await tx.query(
          "SELECT o.*,q.net_inr_minor FROM sell_orders o JOIN quotes q ON q.id=o.quote_id WHERE o.id=$1 FOR UPDATE OF o",
          [id],
        )
      ).rows[0]!;
      let p = (
        await tx.query("SELECT * FROM payouts WHERE order_id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0];
      if (p) {
        if (p.provider !== "manual" || p.lifecycle !== "PROCESSING")
          throw new ConflictException("Payout not processable");
        return this.bankResult(tx, admin, p, b.note);
      }
      if (
        o.status !== "payout_pending" ||
        o.funding_source !== "wallet" ||
        !(
          await tx.query("SELECT 1 FROM ledger_journals WHERE event_key=$1", [
            "sell:" + id,
          ])
        ).rows.length
      )
        throw new ConflictException("Funded wallet order required");
      const bank = (
        await tx.query(
          `SELECT * FROM bank_accounts WHERE id=$1 AND user_id=$2 AND disabled_at IS NULL AND (verification_status='verified' ${selfDeclaredManualBanks() ? 'OR self_declared' : ''}) FOR UPDATE`,
          [o.bank_account_id, o.user_id],
        )
      ).rows[0];
      if (!bank) throw new ConflictException("Available bank account required");
      const limits = payoutConfig(),
        minor = BigInt(o.net_inr_minor);
      if (minor < limits.min || minor > limits.max)
        throw new ConflictException("Payout amount requires review");
      if (
        new Date(bank.created_at).getTime() + limits.bankAge * 1000 >
        Date.now()
      )
        throw new ConflictException("New bank account cooling period");
      const day = new Date().toISOString().slice(0, 10);
      await tx.query(
        "INSERT INTO payout_platform_daily(day) VALUES($1) ON CONFLICT DO NOTHING",
        [day],
      );
      const daily = (
        await tx.query(
          "SELECT committed_inr_minor FROM payout_platform_daily WHERE day=$1 FOR UPDATE",
          [day],
        )
      ).rows[0]!;
      if (BigInt(daily.committed_inr_minor) + minor > limits.daily)
        throw new ConflictException("Platform payout limit reached");
      await tx.query(
        "UPDATE payout_platform_daily SET committed_inr_minor=committed_inr_minor+$2 WHERE day=$1",
        [day, minor.toString()],
      );
      const pid = randomUUID(),
        snapshot = {
          holder: this.crypto.decrypt(
            bank.holder_name_ciphertext,
            bank.id + ":holder",
          ),
          accountNumber: this.crypto.decrypt(
            bank.account_number_ciphertext,
            bank.id + ":number",
          ),
          maskedAccount: "XXXXXX" + bank.last_four,
          ifsc: bank.ifsc,
          bank: bank.bank_name,
          bankId: bank.id,
        };
      p = (
        await tx.query(
          "INSERT INTO payouts(id,order_id,user_id,bank_account_id,beneficiary_snapshot_ciphertext,rail,amount_inr_minor,idempotency_key,provider,sandbox,lifecycle) VALUES($1,$2,$3,$4,$5,$9,$6,$7,'manual',$8,'QUEUED') RETURNING *",
          [
            pid,
            id,
            o.user_id,
            bank.id,
            this.crypto.encrypt(JSON.stringify(snapshot), "payout:" + pid),
            o.net_inr_minor,
            "manual-order:" + id,
            o.sandbox,
            b.method,
          ],
        )
      ).rows[0]!;
      await this.transitions.move(
        tx,
        id,
        "payout_processing",
        "MANUAL_BANK_TRANSFER_STARTED",
        { id: admin, kind: "admin" },
      );
      await tx.query("UPDATE payouts SET lifecycle='SUBMITTED' WHERE id=$1", [
        pid,
      ]);
      await tx.query(
        "UPDATE payouts SET lifecycle='PROCESSING',submitted_at=now() WHERE id=$1",
        [pid],
      );
      await this.event(
        tx,
        admin,
        o.user_id,
        id,
        "READY_FOR_MANUAL_PAYOUT",
        "PAYOUT_IN_PROGRESS",
        b.note,
      );
      return this.bankResult(tx, admin, p, b.note);
    });
  }
  async reviewOrder(admin:string,id:string,body:unknown){
    requireManual('payout');
    await this.permission(admin,'payouts.review');
    const b=input(z.object({action:z.enum(['review','reject']),confirm:z.literal(true),note}).strict(),body);
    return this.db.transaction(async tx=>{
      const order=(await tx.query('SELECT * FROM sell_orders WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if(!order)throw new NotFoundException();
      const key='manual-sell-'+b.action+':'+id;
      if((await tx.query('SELECT 1 FROM risk_flags WHERE dedupe_key=$1',[key])).rows.length)return {status:'MANUAL_REVIEW',duplicate:true,liabilityRetained:true};
      if(order.status!=='payout_pending'||order.funding_source!=='wallet'||(await tx.query('SELECT 1 FROM payouts WHERE order_id=$1',[id])).rows.length)
        throw new ConflictException('Only an unprocessed manual sell request can be reviewed here');
      const code=b.action==='reject'?'MANUAL_SELL_REJECTED':'MANUAL_SELL_REVIEW';
      await tx.query("INSERT INTO risk_flags(user_id,order_id,code,severity,dedupe_key,sanitized_context) VALUES($1,$2,$3,'high',$4,$5)",[order.user_id,id,code,key,JSON.stringify({liabilityRetained:true,adminId:admin})]);
      await this.transitions.move(tx,id,'review',code,{id:admin,kind:'admin'});
      await this.event(tx,admin,order.user_id,id,order.status,'MANUAL_REVIEW',b.note);
      await tx.query("INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES('admin',$1,$2,'sell_order',$3,gen_random_uuid(),$4)",[admin,'manual.sell.'+b.action,id,JSON.stringify({note:b.note,liabilityRetained:true,financialValuesChanged:false})]);
      return {status:'MANUAL_REVIEW',liabilityRetained:true,financialValuesChanged:false};
    });
  }
  async beneficiary(admin:string,id:string,body:unknown){
    await this.permission(admin,'PAYOUT_PROCESS');
    const b=input(z.object({confirm:z.literal(true),reason:note}).strict(),body);
    return this.db.transaction(async tx=>{
      const p=(await tx.query("SELECT * FROM payouts WHERE (id=$1 OR order_id=$1) AND provider='manual'",[id])).rows[0];
      if(!p)throw new NotFoundException('Beneficiary snapshot unavailable');
      // Always reveal the immutable accepted beneficiary, never a later bank edit.
      return this.bankResult(tx,admin,p,b.reason);
    });
  }
  async bankResult(tx: SqlClient, admin: string, p: any, reason: string) {
    await tx.query(
      "INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES('admin',$1,'manual.bank_reveal','payout',$2,$3,$4)",
      [
        admin,
        p.id,
        randomUUID(),
        JSON.stringify({ reason, userId: p.user_id }),
      ],
    );
    return {
      payoutId: p.id,
      orderId: p.order_id,
      amountInrMinor: String(p.amount_inr_minor),
      bank: JSON.parse(
        this.crypto.decrypt(
          p.beneficiary_snapshot_ciphertext,
          "payout:" + p.id,
        ),
      ),
    };
  }
  async confirm(admin: string, id: string, body: unknown) {
    requireManual("payout");
    const b = input(
      z
        .object({
          amountInr: z.string().regex(/^\d{1,14}(\.\d{1,2})?$/),
          utr: z
            .string()
            .trim()
            .min(6)
            .max(100)
            .regex(/^[A-Za-z0-9-]+$/)
            .transform((s) => s.toUpperCase()),
          paidAt: z.string().datetime(),
          bankUsed: z.string().min(2).max(100),
          note,
          receiptId: z.string().uuid(),
          bankTransferConfirmed:z.literal(true),
        })
        .strict(),
      body,
    );
    await this.permission(admin, "PAYOUT_CONFIRM");
    return this.db.transaction(async (tx) => {
      const owner = (
        await tx.query("SELECT user_id FROM sell_orders WHERE id=$1", [id])
      ).rows[0];
      if (!owner) throw new NotFoundException();
      await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        owner.user_id,
      ]);
      await tx.query("SELECT id FROM sell_orders WHERE id=$1 FOR UPDATE", [id]);
      const p = (
        await tx.query(
          "SELECT * FROM payouts WHERE order_id=$1 AND provider='manual' FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!p) throw new NotFoundException();
      if (p.lifecycle === "SUCCESS") {
        if (
          p.utr !== b.utr || p.manual_receipt_id !== b.receiptId ||
          BigInt(p.amount_inr_minor) !== decimal(b.amountInr, 2) ||
          new Date(p.manual_paid_at).getTime() !== new Date(b.paidAt).getTime() ||
          p.manual_bank_used !== b.bankUsed || p.manual_note !== b.note
        )
          throw new ConflictException();
        return { status: "COMPLETED", duplicate: true };
      }
      await this.gate(tx,'payouts');
      const resolvingReview = p.lifecycle === "MANUAL_REVIEW";
      if (resolvingReview) await this.permission(admin, "payouts.review", tx);
      if (
        !["PROCESSING", "MANUAL_REVIEW"].includes(p.lifecycle) ||
        BigInt(p.amount_inr_minor) !== decimal(b.amountInr, 2) ||
        new Date(b.paidAt) > new Date() ||
        new Date(b.paidAt) < new Date(p.created_at)
      )
        throw new BadRequestException(
          "Exact amount and valid payment time required",
        );
      const f = (
        await tx.query(
          "SELECT id FROM private_financial_files WHERE id=$1 AND admin_id=$2 AND purpose='receipt'",
          [b.receiptId, admin],
        )
      ).rows[0];
      if (!f) throw new NotFoundException("Upload your private receipt first");
      const o = (
        await tx.query(
          "SELECT status FROM sell_orders WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (o?.status !== (resolvingReview ? "review" : "payout_processing"))
        throw new ConflictException();
      const liability = await this.ledger.account(
          tx,
          p.user_id,
          "INR",
          "payout_clearing",
        ),
        clearing = await this.ledger.account(
          tx,
          null,
          "INR",
          "payout_clearing",
        );
      if (
        !(await this.ledger.post(tx, "payout:" + p.id, "payout", p.id, [
          {
            account: liability,
            asset: "INR",
            side: "debit",
            amount: b.amountInr,
          },
          {
            account: clearing,
            asset: "INR",
            side: "credit",
            amount: b.amountInr,
          },
        ]))
      )
        throw new ConflictException("Already settled");
      await tx.query(
        "UPDATE payouts SET lifecycle='SUCCESS',status='success',utr=$2,provider_ref=$2,manual_receipt_id=$3,manual_paid_at=$4,manual_confirmed_by=$5,manual_bank_used=$6,manual_note=$7,completed_at=now() WHERE id=$1",
        [p.id, b.utr, b.receiptId, b.paidAt, admin, b.bankUsed, b.note],
      );
      await this.event(
        tx,
        admin,
        p.user_id,
        id,
        resolvingReview ? "MANUAL_REVIEW" : "PAYOUT_IN_PROGRESS",
        "PAID",
        b.note,
      );
      await this.transitions.move(
        tx,
        id,
        "completed",
        resolvingReview
          ? "MANUAL_REVIEW_PAYMENT_EVIDENCE_CONFIRMED"
          : "MANUAL_PAYMENT_EVIDENCE_CONFIRMED",
        { id: admin, kind: "admin" },
      );
      await this.event(
        tx,
        admin,
        p.user_id,
        id,
        "PAID",
        "COMPLETED",
        "Bank payment recorded. Your receipt is available.",
      );
      return { status: "COMPLETED", utr: b.utr, receiptId: b.receiptId };
    });
  }
  async failPayout(admin:string,id:string,body:unknown){
    requireManual('payout');
    const b=input(z.object({note,confirm:z.literal(true),noTransferConfirmed:z.literal(true)}).strict(),body);
    await this.permission(admin,'PAYOUT_CONFIRM');
    return this.db.transaction(async tx=>{
      const o=(await tx.query('SELECT * FROM sell_orders WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if(!o)throw new NotFoundException();
      const p=(await tx.query("SELECT * FROM payouts WHERE order_id=$1 AND provider='manual' FOR UPDATE",[id])).rows[0];
      if(p?.lifecycle==='FAILED')return {status:'FAILED',duplicate:true,noLedgerChange:true};
      const reviewed=p?.lifecycle==='MANUAL_REVIEW';
      if(reviewed)await this.permission(admin,'payouts.review',tx);
      if(!p||!['PROCESSING','MANUAL_REVIEW'].includes(p.lifecycle)||o.status!==(reviewed?'review':'payout_processing')||p.utr||p.manual_receipt_id)throw new ConflictException('Only an unsettled manual payout can be marked failed');
      if((await tx.query('SELECT 1 FROM ledger_journals WHERE event_key=$1',['payout:'+p.id])).rows.length)throw new ConflictException('Settled payout cannot be failed');
      await tx.query("UPDATE payouts SET lifecycle='FAILED',status='failed',failure_code='MANUAL_CONFIRMED_NO_TRANSFER',failure_reason=$2,processed_at=now() WHERE id=$1",[p.id,b.note]);
      await tx.query("INSERT INTO payout_status_history(payout_id,status,reason) VALUES($1,'FAILED',$2)",[p.id,b.note]);
      await this.transitions.move(tx,id,'failed','MANUAL_CONFIRMED_NO_TRANSFER',{id:admin,kind:'admin'});
      await this.event(tx,admin,o.user_id,id,'PAYOUT_IN_PROGRESS','FAILED',b.note);
      return {status:'FAILED',noLedgerChange:true,liabilityRetained:true};
    });
  }
  async refundFailed(admin:string,id:string,body:unknown){
    requireManual('payout');
    const b=input(z.object({note,receiptId:z.string().uuid(),confirm:z.literal(true),noTransferConfirmed:z.literal(true)}).strict(),body);
    await this.permission(admin,'PAYOUT_CONFIRM');
    await this.permission(admin,'payouts.review');
    return this.db.transaction(async tx=>{
      const owner=(await tx.query('SELECT user_id FROM sell_orders WHERE id=$1',[id])).rows[0];
      if(!owner)throw new NotFoundException();
      await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[owner.user_id]);
      const o=(await tx.query('SELECT * FROM sell_orders WHERE id=$1 FOR UPDATE',[id])).rows[0]!;
      const prior=(await tx.query('SELECT * FROM manual_order_refunds WHERE order_id=$1',[id])).rows[0];
      if(prior){
        if(prior.receipt_id!==b.receiptId||prior.reason!==b.note)throw new ConflictException('Refund evidence conflicts with the recorded recovery');
        return {status:'CANCELLED',refunded:true,duplicate:true};
      }
      await this.gate(tx,'payouts');
      const p=(await tx.query('SELECT * FROM payouts WHERE order_id=$1 FOR UPDATE',[id])).rows[0];
      const rejected=!p && o.status==='review' && (await tx.query("SELECT 1 FROM risk_flags WHERE order_id=$1 AND code='MANUAL_SELL_REJECTED'",[id])).rows.length>0;
      const failed=p?.provider==='manual'&&p.lifecycle==='FAILED'&&p.failure_code==='MANUAL_CONFIRMED_NO_TRANSFER'&&o.status==='failed'&&!p.utr&&!p.manual_receipt_id;
      if(o.funding_source!=='wallet'||(!rejected&&!failed))throw new ConflictException('Definitively failed payment or rejected unprocessed wallet order required');
      if(p&&(await tx.query("SELECT 1 FROM ledger_journals WHERE event_key=$1",['payout:'+p.id])).rows.length)throw new ConflictException('Settled payment cannot be refunded');
      if(!(await tx.query("SELECT 1 FROM private_financial_files WHERE id=$1 AND admin_id=$2 AND purpose='receipt'",[b.receiptId,admin])).rows.length)throw new NotFoundException('Upload your private no-transfer evidence first');
      for(const type of ['reserve','sell']){
        if(!(await tx.query('SELECT 1 FROM ledger_journals WHERE event_key=$1',[type+':'+id])).rows.length)throw new ConflictException('Original wallet funding journal required');
      }
      await this.ledger.reverseSell(tx,id);
      await tx.query('INSERT INTO manual_order_refunds(order_id,admin_id,receipt_id,reason) VALUES($1,$2,$3,$4)',[id,admin,b.receiptId,b.note]);
      await this.transitions.move(tx,id,'cancelled','MANUAL_NO_TRANSFER_REFUNDED',{id:admin,kind:'admin'});
      await this.event(tx,admin,o.user_id,id,o.status,'CANCELLED','Order cancelled after no-transfer verification. Original USDT and sell fees restored to your wallet.');
      await tx.query("INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES('admin',$1,'manual.sell.refund','sell_order',$2,gen_random_uuid(),$3)",[admin,id,JSON.stringify({receiptId:b.receiptId,note:b.note})]);
      return {status:'CANCELLED',refunded:true,duplicate:false};
    });
  }
  async payoutReview(admin: string, id: string, body: unknown) {
    requireManual("payout");
    const b = input(z.object({ note }).strict(), body);
    await this.permission(admin, "PAYOUT_CONFIRM");
    return this.db.transaction(async (tx) => {
      const o = (
        await tx.query("SELECT * FROM sell_orders WHERE id=$1 FOR UPDATE", [id])
      ).rows[0];
      if (!o) throw new NotFoundException();
      const p = (
        await tx.query(
          "SELECT * FROM payouts WHERE order_id=$1 AND provider='manual' FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!p || p.lifecycle !== "PROCESSING")
        throw new ConflictException("Processing manual payout required");
      await tx.query(
        "UPDATE payouts SET lifecycle='MANUAL_REVIEW' WHERE id=$1",
        [p.id],
      );
      await this.transitions.move(tx, id, "review", b.note, {
        id: admin,
        kind: "admin",
      });
      await this.event(
        tx,
        admin,
        o.user_id,
        id,
        "PAYOUT_IN_PROGRESS",
        "MANUAL_REVIEW",
        b.note,
      );
      return { status: "MANUAL_REVIEW" };
    });
  }
  async dashboard(admin: string) {
    await this.permission(admin, "DEPOSIT_REVIEW");
    await this.permission(admin, "PAYOUT_VIEW");
    return (
      await this.db.query(
        "SELECT (SELECT count(*) FROM manual_deposit_requests WHERE status='PROOF_SUBMITTED') proofs_pending,(SELECT count(*) FROM manual_deposit_requests WHERE status='UNDER_REVIEW') under_review,(SELECT count(*) FROM manual_deposit_requests WHERE status='CREDITED' AND updated_at::date=current_date) approved_today,(SELECT count(*) FROM manual_deposit_requests WHERE status='REJECTED' AND updated_at::date=current_date) rejected_today,(SELECT count(*) FROM sell_orders WHERE funding_source='wallet' AND status='payout_pending') payouts_pending,(SELECT count(*) FROM payouts WHERE provider='manual' AND lifecycle='PROCESSING') payouts_processing,(SELECT count(*) FROM payouts WHERE provider='manual' AND lifecycle='SUCCESS' AND completed_at::date=current_date) completed_today,(SELECT count(*) FROM sell_orders WHERE status='review') manual_review",
      )
    ).rows[0];
  }
}

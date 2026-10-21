import {
  Injectable,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID, createHash } from "node:crypto";
import { DatabaseService, SqlClient } from "../../common/database.service";
import { CryptoService } from "../../common/crypto.service";
import { LedgerService } from "../ledger/ledger.service";
import { OrderTransitionService } from "../orders/order-transition.service";
import { format } from "../rates/money";
import {
  PayoutProvider,
  PayoutTransientError,
  payoutConfig,
  ProviderResult,
  Rail,
  validateResult,
} from "./payout.provider";
@Injectable()
export class PayoutsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: CryptoService,
    private readonly ledger: LedgerService,
    private readonly orders: OrderTransitionService,
    private readonly provider: PayoutProvider,
  ) {}
  async audit(
    tx: SqlClient,
    id: string,
    action: string,
    actor = "payout-worker",
    reason = action,
    kind = "service",
  ) {
    await tx.query(
      "INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES($1,$2,$3,'payout',$4,$5,$6)",
      [kind, actor, action, id, randomUUID(), JSON.stringify({ reason })],
    );
  }
  async event(
    tx: SqlClient,
    p: any,
    status: string,
    reason: string,
    attempt?: string,
  ) {
    await tx.query(
      "INSERT INTO payout_status_history(payout_id,attempt_id,status,reason) VALUES($1,$2,$3,$4)",
      [p.id, attempt ?? null, status, reason],
    );
    await this.audit(
      tx,
      p.id,
      "payout." + status.toLowerCase(),
      "payout-worker",
      reason,
    );
    console.log(
      JSON.stringify({
        event: "payout_status_staged",
        payoutId: p.id,
        status,
        reason,
      }),
    );
    const titles: Record<string, string> = {
      QUEUED: "Payout Started",
      PROCESSING: "Payout Processing",
      SUCCESS: "Payout Successful",
      FAILED: "Payout Failed",
      MANUAL_REVIEW: "Payout Under Review",
      REVERSED: "Payout Under Review",
    };
    if (titles[status]) {
      const title = titles[status]!;
      const body = p.sandbox
        ? "Sandbox payout update — no real bank transfer."
        : "Your INR payout status has been updated.";
      await tx.query(
        "INSERT INTO notifications(user_id,type,title,body,data) VALUES($1,$2,$3,$4,$5)",
        [
          p.user_id,
          "payout." + status.toLowerCase(),
          title,
          body,
          JSON.stringify({
            orderId: p.order_id,
            payoutId: p.id,
            sandbox: p.sandbox,
          }),
        ],
      );
      await tx.query(
        "INSERT INTO outbox_events(aggregate_type,aggregate_id,event_type,dedupe_key,payload) VALUES('payout',$1,'notification.payout',$2,$3) ON CONFLICT(dedupe_key) DO NOTHING",
        [
          p.id,
          `notice:${p.id}:${attempt}:${status}`,
          JSON.stringify({ userId: p.user_id, status, payoutId: p.id }),
        ],
      );
    }
  }
  private async lock(tx: SqlClient, id: string) {
    const p = (await tx.query("SELECT user_id FROM payouts WHERE id=$1", [id]))
      .rows[0];
    if (!p) throw new NotFoundException();
    await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [p.user_id]);
    return (
      await tx.query("SELECT * FROM payouts WHERE id=$1 FOR UPDATE", [id])
    ).rows[0]!;
  }
  private async eligible(tx: SqlClient, orderId: string) {
    const o = (
      await tx.query(
        `SELECT o.*,q.net_inr_minor FROM sell_orders o JOIN quotes q ON q.id=o.quote_id WHERE o.id=$1 FOR UPDATE OF o`,
        [orderId],
      )
    ).rows[0];
    if (
      !o ||
      !["payout_pending", "payout_processing", "failed"].includes(o.status)
    )
      throw new ConflictException("Order is not eligible");
    const u = (
      await tx.query(
        "SELECT status,verification_status FROM users WHERE id=$1",
        [o.user_id],
      )
    ).rows[0];
    if (u?.status !== "active" || u.verification_status !== "verified")
      throw new ConflictException("Account unavailable");
    const b = (
      await tx.query(
        "SELECT * FROM bank_accounts WHERE id=$1 AND user_id=$2 AND disabled_at IS NULL AND verification_status='verified' FOR UPDATE",
        [o.bank_account_id, o.user_id],
      )
    ).rows[0];
    if (!b) throw new ConflictException("Verified bank required");
    if (
      (
        await tx.query(
          "SELECT 1 FROM risk_flags WHERE user_id=$1 AND state<>'resolved'",
          [o.user_id],
        )
      ).rows.length
    )
      throw new ConflictException("Payout requires review");
    const failed = (
      await tx.query(
        "SELECT count(*)::int n FROM payout_attempts a JOIN payouts p ON p.id=a.payout_id WHERE p.user_id=$1 AND a.lifecycle='FAILED' AND a.started_at>now()-interval '24 hours'",
        [o.user_id],
      )
    ).rows[0]!;
    if (failed.n >= payoutConfig().failedLimit)
      throw new ConflictException("Payout requires review");
    if (
      new Date(b.created_at).getTime() + payoutConfig().bankAge * 1000 >
      Date.now()
    )
      throw new ConflictException("Payout requires review");
    const sale = (
      await tx.query(
        "SELECT j.id FROM ledger_journals j WHERE event_key=$1 AND NOT EXISTS(SELECT 1 FROM ledger_journals r WHERE r.reversal_of=j.id)",
        ["sell:" + o.id],
      )
    ).rows[0];
    if (!sale) throw new ConflictException("Funding ledger unavailable");
    const deposits = (
      await tx.query(
        `SELECT d.id FROM deposits d JOIN blockchain_transactions b ON b.id=d.transaction_id JOIN ledger_journals j ON j.event_key='deposit:'||b.network_code||':'||b.tx_hash WHERE d.user_id=$1 AND d.status='credited' AND b.status='confirmed' AND b.confirmations>=greatest(b.required_confirmations,$3) AND NOT EXISTS(SELECT 1 FROM ledger_journals r WHERE r.reversal_of=j.id) AND ($2::text='wallet' OR EXISTS(SELECT 1 FROM order_deposit_allocations x WHERE x.deposit_id=d.id AND x.order_id=$4))`,
        [o.user_id, o.funding_source, o.required_confirmations, o.id],
      )
    ).rows;
    if (!deposits.length)
      throw new ConflictException("Confirmed funding required");
    return { o, b };
  }
  async create(orderId: string, rail: Rail = "IMPS") {
    if(process.env.MANUAL_PAYOUT==='true'||process.env.AUTOMATED_PAYOUT==='false') throw new ConflictException("Automatic payout disabled");
    const c = payoutConfig();
    if (!c.enabled)
      throw new ServiceUnavailableException("Payout execution disabled");
    if (!this.provider.capabilities.rails.includes(rail))
      throw new ConflictException("Payout method unavailable");
    return this.db.transaction(async (tx) => {
      const owner = (
        await tx.query("SELECT user_id FROM sell_orders WHERE id=$1", [orderId])
      ).rows[0];
      if (!owner) throw new NotFoundException();
      await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        owner.user_id,
      ]);
      const existing = (
        await tx.query("SELECT id FROM payouts WHERE order_id=$1", [orderId])
      ).rows[0];
      if (existing) return existing.id;
      const { o, b } = await this.eligible(tx, orderId);
      if (o.status !== "payout_pending") throw new ConflictException();
      const amount = BigInt(o.net_inr_minor);
      if (
        amount < c.min ||
        amount > c.max ||
        amount < this.provider.capabilities.minMinor ||
        amount > this.provider.capabilities.maxMinor
      )
        throw new ConflictException("Payout limit");
      const id = randomUUID();
      const snapshot = {
        holder: this.crypto.decrypt(b.holder_name_ciphertext, b.id + ":holder"),
        accountNumber: this.crypto.decrypt(
          b.account_number_ciphertext,
          b.id + ":number",
        ),
        maskedAccount: "XXXXXX" + b.last_four,
        ifsc: b.ifsc,
        bank: b.bank_name,
        bankId: b.id,
      };
      const p = (
        await tx.query(
          "INSERT INTO payouts(id,order_id,user_id,bank_account_id,beneficiary_snapshot_ciphertext,rail,amount_inr_minor,idempotency_key,provider,sandbox) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
          [
            id,
            o.id,
            o.user_id,
            b.id,
            this.crypto.encrypt(JSON.stringify(snapshot), "payout:" + id),
            rail,
            o.net_inr_minor,
            "order:" + o.id,
            this.provider.name,
            this.provider.sandbox,
          ],
        )
      ).rows[0]!;
      await this.queue(tx, p, 1);
      return id;
    });
  }
  private async queue(tx: SqlClient, p: any, n: number) {
    const a = (
      await tx.query(
        "INSERT INTO payout_attempts(payout_id,attempt_number,provider_request_key,status,provider) VALUES($1,$2,$3,'pending',$4) RETURNING *",
        [p.id, n, `${p.order_id}:payout:${n}`, p.provider],
      )
    ).rows[0]!;
    await tx.query(
      "UPDATE payouts SET lifecycle='QUEUED',status='pending',failure_code=NULL,failure_reason=NULL WHERE id=$1",
      [p.id],
    );
    const o = (
      await tx.query("SELECT status FROM sell_orders WHERE id=$1", [p.order_id])
    ).rows[0];
    if (o?.status === "failed")
      await this.orders.move(
        tx,
        p.order_id,
        "payout_pending",
        "ELIGIBLE_RETRY",
      );
    await tx.query(
      "INSERT INTO outbox_events(aggregate_type,aggregate_id,event_type,dedupe_key,payload) VALUES('payout',$1,'payout.submit',$2,$3)",
      [
        p.id,
        "submit:" + a.id,
        JSON.stringify({ payoutId: p.id, attemptId: a.id }),
      ],
    );
    await this.event(tx, p, "QUEUED", "PAYOUT_QUEUED", a.id);
  }
  async submit(id: string) {
    if(process.env.MANUAL_PAYOUT==='true'||process.env.AUTOMATED_PAYOUT==='false') throw new ConflictException("Automatic payout disabled");
    if (!payoutConfig().enabled) throw new ServiceUnavailableException();
    const claimed = await this.db.transaction(async (tx) => {
      const p = await this.lock(tx, id);
      const a = (
        await tx.query(
          "SELECT * FROM payout_attempts WHERE payout_id=$1 ORDER BY attempt_number DESC LIMIT 1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!a || a.lifecycle !== "QUEUED") return null;
      try {
        await this.eligible(tx, p.order_id);
      } catch {
        await this.review(tx, p, "ELIGIBILITY_REVIEW", a.id);
        return null;
      }
      const limits = payoutConfig(),
        amount = BigInt(p.amount_inr_minor);
      if (
        amount < limits.min ||
        amount > limits.max ||
        amount < this.provider.capabilities.minMinor ||
        amount > this.provider.capabilities.maxMinor ||
        !this.provider.capabilities.rails.includes(p.rail)
      ) {
        await this.review(tx, p, "PAYOUT_LIMIT_REVIEW", a.id);
        return null;
      }
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
      if (
        BigInt(daily.committed_inr_minor) + BigInt(p.amount_inr_minor) >
        payoutConfig().daily
      ) {
        await this.review(tx, p, "PLATFORM_LIMIT_REVIEW", a.id);
        return null;
      }
      await tx.query(
        "UPDATE payout_platform_daily SET committed_inr_minor=committed_inr_minor+$2 WHERE day=$1",
        [day, p.amount_inr_minor],
      );
      await tx.query(
        "UPDATE payouts SET lifecycle='SUBMITTED',status='processing',submitted_at=now() WHERE id=$1",
        [id],
      );
      await tx.query(
        "UPDATE payout_attempts SET lifecycle='SUBMITTED',status='processing',submitted_at=now(),submission_count=submission_count+1 WHERE id=$1",
        [a.id],
      );
      await this.orders.move(
        tx,
        p.order_id,
        "payout_processing",
        "PAYOUT_SUBMITTED",
      );
      await this.event(tx, p, "SUBMITTED", "PROVIDER_SUBMISSION", a.id);
      return { p, a };
    });
    if (!claimed) {
      await this.refresh(id);
      return;
    }
    const { p, a } = claimed;
    try {
      const beneficiary = JSON.parse(
        this.crypto.decrypt(
          p.beneficiary_snapshot_ciphertext,
          "payout:" + p.id,
        ),
      );
      if (
        this.provider.getBeneficiaryStatus &&
        (await this.provider.getBeneficiaryStatus(beneficiary)) !== "VERIFIED"
      ) {
        await this.db.transaction(async (tx) => {
          const locked = await this.lock(tx, id);
          await this.review(tx, locked, "BENEFICIARY_PROVIDER_REVIEW", a.id);
        });
        return;
      }
      const result = await this.provider.createPayout({
        requestKey: a.provider_request_key,
        amountMinor: String(p.amount_inr_minor),
        rail: p.rail,
        beneficiary,
      });
      await this.apply(id, result);
    } catch (error) {
      if (error instanceof PayoutTransientError && error.notAccepted) {
        await this.apply(id, {
          requestKey: a.provider_request_key,
          reference: "NOT-ACCEPTED-" + a.id,
          amountMinor: String(p.amount_inr_minor),
          status: "FAILED",
          definitiveFailure: true,
          failureCode: "TRANSIENT_NOT_ACCEPTED",
        });
        return;
      }
      await this.db.transaction(async (tx) => {
        const current = await this.lock(tx, id);
        if (["SUBMITTED", "PROCESSING"].includes(current.lifecycle))
          await this.review(tx, current, "UNKNOWN_SUBMISSION_OUTCOME", a.id);
      });
    }
  }
  private async review(
    tx: SqlClient,
    p: any,
    reason: string,
    attempt?: string,
  ) {
    if (p.lifecycle === "MANUAL_REVIEW") return;
    await tx.query(
      "UPDATE payouts SET lifecycle='MANUAL_REVIEW',failure_reason=$2 WHERE id=$1",
      [p.id, reason],
    );
    if (attempt)
      await tx.query(
        "UPDATE payout_attempts SET lifecycle='MANUAL_REVIEW',failure_reason=$2,updated_at=now() WHERE id=$1 AND lifecycle IN ('QUEUED','SUBMITTED','PROCESSING')",
        [attempt, reason],
      );
    // Unknown outcome can still be resolved by authenticated provider evidence; order stays processing.
    await this.event(tx, p, "MANUAL_REVIEW", reason, attempt);
  }
  async apply(id: string, input: ProviderResult, txExisting?: SqlClient) {
    const r = validateResult(input);
    const work = async (tx: SqlClient) => {
      const p = await this.lock(tx, id);
      const a = (
        await tx.query(
          "SELECT * FROM payout_attempts WHERE payout_id=$1 AND provider_request_key=$2 FOR UPDATE",
          [id, r.requestKey],
        )
      ).rows[0];
      if (!a) throw new NotFoundException();
      if (
        String(p.amount_inr_minor) !== r.amountMinor ||
        (a.provider_ref && a.provider_ref !== r.reference) ||
        (a.utr && r.utr && a.utr !== r.utr)
      ) {
        await this.issue(tx, p, "PROVIDER_IDENTITY_MISMATCH", {
          providerStatus: r.status,
        });
        await this.review(tx, p, "PROVIDER_IDENTITY_MISMATCH");
        return;
      }
      if (!a.submitted_at || ["QUEUED", "CANCELLED"].includes(a.lifecycle)) {
        await this.issue(tx, p, "UNSUBMITTED_PROVIDER_RESULT", {});
        return;
      }
      if (p.lifecycle === "REVERSED" || a.lifecycle === r.status) return;
      if (a.lifecycle === "FAILED" || p.lifecycle === "FAILED") {
        await this.issue(tx, p, "TERMINAL_STATUS_CONFLICT", {
          providerStatus: r.status,
        });
        return;
      }
      if (p.lifecycle === "SUCCESS" && r.status !== "REVERSED") {
        if (r.status !== "SUCCESS")
          await this.issue(tx, p, "TERMINAL_STATUS_CONFLICT", {
            providerStatus: r.status,
          });
        return;
      }
      const legacy = {
        PROCESSING: "processing",
        SUCCESS: "success",
        FAILED: "failed",
        REVERSED: "reversed",
      }[r.status];
      if (r.status === "FAILED" && !r.definitiveFailure) {
        await this.review(tx, p, "UNCONFIRMED_FAILURE", a.id);
        return;
      }
      if (
        r.status === "REVERSED" &&
        !(
          await tx.query("SELECT id FROM ledger_journals WHERE event_key=$1", [
            "payout:" + id,
          ])
        ).rows.length
      ) {
        await this.review(tx, p, "REVERSAL_BEFORE_SETTLEMENT", a.id);
        await this.issue(tx, p, "REVERSAL_BEFORE_SETTLEMENT", {});
        return;
      }
      if (r.status === "SUCCESS") {
        const amount = format(BigInt(p.amount_inr_minor), 2),
          liability = await this.ledger.account(
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
        await this.ledger.post(tx, "payout:" + p.id, "payout", p.id, [
          { account: liability, asset: "INR", side: "debit", amount },
          { account: clearing, asset: "INR", side: "credit", amount },
        ]);
      }
      if (r.status === "REVERSED")
        await this.ledger.reverse(tx, "payout:" + p.id);
      await tx.query(
        "UPDATE payouts SET lifecycle=$2,status=$3::payout_status,provider_ref=$4,utr=coalesce($5,utr),failure_code=$6,failure_reason=$6,processed_at=now(),completed_at=CASE WHEN $2='SUCCESS' THEN now() ELSE completed_at END,reversed_at=CASE WHEN $2='REVERSED' THEN now() ELSE reversed_at END,reversal_reference=$7,last_checked_at=now() WHERE id=$1",
        [
          id,
          r.status,
          legacy,
          r.reference,
          r.utr ?? null,
          r.failureCode?.slice(0, 80) ?? null,
          r.reversalReference ?? null,
        ],
      );
      await tx.query(
        "UPDATE payout_attempts SET lifecycle=$2,status=$3::payout_status,provider_ref=$4,utr=coalesce($5,utr),definitive_failure=$6,response_code=$7,resolved_at=CASE WHEN $2 IN ('SUCCESS','FAILED','REVERSED') THEN now() ELSE NULL END,updated_at=now() WHERE id=$1",
        [
          a.id,
          r.status,
          legacy,
          r.reference,
          r.utr ?? null,
          r.definitiveFailure ?? false,
          r.failureCode?.slice(0, 80) ?? null,
        ],
      );
      const order = (
        await tx.query("SELECT status FROM sell_orders WHERE id=$1", [
          p.order_id,
        ])
      ).rows[0]!;
      if (r.status === "SUCCESS" && order.status === "payout_processing")
        await this.orders.move(
          tx,
          p.order_id,
          "completed",
          "PROVIDER_CONFIRMED_SUCCESS",
        );
      else if (r.status === "SUCCESS")
        await this.issue(tx, p, "PAID_ORDER_UNDER_REVIEW", {
          orderStatus: order.status,
        });
      if (r.status === "FAILED" && order.status === "payout_processing")
        await this.orders.move(
          tx,
          p.order_id,
          "failed",
          "PROVIDER_CONFIRMED_FAILURE",
        );
      if (r.status === "REVERSED" && order.status !== "review")
        await this.orders.move(tx, p.order_id, "review", "PROVIDER_REVERSAL");
      await this.event(tx, p, r.status, "PROVIDER_" + r.status, a.id);
      if (r.status === "SUCCESS" && order.status === "payout_processing")
        await tx.query(
          "INSERT INTO notifications(user_id,type,title,body,data) VALUES($1,'transaction.completed','Transaction Completed',$2,$3)",
          [
            p.user_id,
            p.sandbox
              ? "Sandbox transaction completed; no real INR sent."
              : "Your INR payout is complete.",
            JSON.stringify({ orderId: p.order_id, sandbox: p.sandbox }),
          ],
        );
    };
    if (txExisting) await work(txExisting);
    else await this.db.transaction(work);
  }
  async refresh(id: string) {
    const p = (await this.db.query("SELECT * FROM payouts WHERE id=$1", [id]))
      .rows[0];
    if (!p) throw new NotFoundException();
    const a = (
      await this.db.query(
        "SELECT * FROM payout_attempts WHERE payout_id=$1 ORDER BY attempt_number DESC LIMIT 1",
        [id],
      )
    ).rows[0];
    if (!a || a.lifecycle === "QUEUED") return;
    const r = await this.provider.getPayoutStatus(a.provider_request_key);
    await this.db.query(
      "UPDATE payouts SET last_checked_at=now() WHERE id=$1",
      [id],
    );
    if (r) await this.apply(id, r);
    else
      await this.db.transaction(async (tx) => {
        const locked = await this.lock(tx, id);
        await this.issue(tx, locked, "MISSING_PROVIDER", {});
        await this.review(tx, locked, "MISSING_PROVIDER", a.id);
      });
  }
  async retry(id: string, actor: string, reason: string, kind = "admin") {
    return this.db.transaction(async (tx) => {
      const p = await this.lock(tx, id);
      const a = (
        await tx.query(
          "SELECT * FROM payout_attempts WHERE payout_id=$1 ORDER BY attempt_number DESC LIMIT 1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (
        p.lifecycle !== "FAILED" ||
        !a?.definitive_failure ||
        a.attempt_number >= payoutConfig().retries + 1
      )
        throw new ConflictException("Retry is not safe");
      await this.eligible(tx, p.order_id);
      await this.audit(tx, id, "payout.retry", actor, reason, kind);
      await this.queue(tx, p, a.attempt_number + 1);
      return { queued: true };
    });
  }
  async markStale(id: string) {
    await this.db.transaction(async (tx) => {
      const p = await this.lock(tx, id);
      await this.review(tx, p, "STALE_PROVIDER_OUTCOME");
    });
  }
  async manualReview(id: string, actor: string, reason: string) {
    return this.db.transaction(async (tx) => {
      const p = await this.lock(tx, id);
      await this.audit(tx, id, "payout.review", actor, reason, "admin");
      await this.review(tx, p, "ADMIN_REVIEW");
      await this.orders.move(tx, p.order_id, "review", "ADMIN_PAYOUT_REVIEW");
      return { review: true };
    });
  }
  async issue(tx: SqlClient, p: any, type: string, context: any) {
    if (p?.user_id)
      await tx.query(
        "INSERT INTO risk_flags(user_id,order_id,code,severity,dedupe_key) VALUES($1,$2,$3,'high',$4) ON CONFLICT(dedupe_key) DO NOTHING",
        [p.user_id, p.order_id, type, "payout-issue:" + p.id + ":" + type],
      );
    await tx.query(
      "INSERT INTO reconciliation_issues(payout_id,issue_type,dedupe_key,status,safe_context) VALUES($1,$2,$3,$4,$5) ON CONFLICT(dedupe_key) DO NOTHING",
      [
        p?.id ?? null,
        type,
        (p?.id ?? context.reference) + ":" + type,
        type === "MISSING_PROVIDER"
          ? "MISSING_PROVIDER"
          : type === "MISSING_INTERNAL"
            ? "MISSING_INTERNAL"
            : "MISMATCH",
        JSON.stringify(context),
      ],
    );
  }
  async reconcile(id: string) {
    const p = (await this.db.query("SELECT * FROM payouts WHERE id=$1", [id]))
      .rows[0];
    if (!p) throw new NotFoundException();
    const a = (
      await this.db.query(
        "SELECT * FROM payout_attempts WHERE payout_id=$1 ORDER BY attempt_number DESC LIMIT 1",
        [id],
      )
    ).rows[0];
    if (!a) return;
    await this.db.query(
      "UPDATE payouts SET last_reconciled_at=now() WHERE id=$1",
      [id],
    );
    const r = await this.provider.getPayoutStatus(a.provider_request_key);
    await this.db.transaction(async (tx) => {
      const current = await this.lock(tx, id);
      const settlement = (
        await tx.query("SELECT id FROM ledger_journals WHERE event_key=$1", [
          "payout:" + id,
        ])
      ).rows[0];
      const o = (
        await tx.query("SELECT status FROM sell_orders WHERE id=$1", [
          p.order_id,
        ])
      ).rows[0];
      const reversal = (
        await tx.query("SELECT id FROM ledger_journals WHERE event_key=$1", [
          "reverse:payout:" + id,
        ])
      ).rows[0];
      const mismatch = !r
        ? "MISSING_PROVIDER"
        : r.reference !== a.provider_ref && a.provider_ref
          ? "REFERENCE_MISMATCH"
          : r.amountMinor !== String(p.amount_inr_minor)
            ? "AMOUNT_MISMATCH"
            : r.status !== current.lifecycle
              ? "STATUS_MISMATCH"
              : current.utr && r.utr !== current.utr
                ? "UTR_MISMATCH"
                : current.lifecycle === "SUCCESS" &&
                    (!settlement || o?.status !== "completed")
                  ? "LEDGER_ORDER_MISMATCH"
                  : current.lifecycle === "REVERSED" &&
                      (!reversal || o?.status !== "review")
                    ? "REVERSAL_LEDGER_MISMATCH"
                    : null;
      if (mismatch)
        await this.issue(tx, current, mismatch, {
          providerStatus: r?.status ?? null,
          internalStatus: current.lifecycle,
          ledgerSettled: !!settlement,
        });
      await this.audit(
        tx,
        id,
        "payout.reconcile",
        "reconciliation-worker",
        mismatch ?? "MATCHED",
      );
    });
  }
  async webhook(
    provider: string,
    raw: Buffer,
    timestamp: string,
    signature: string,
  ) {
    if (provider !== this.provider.name) throw new NotFoundException();
    this.provider.verifyWebhook(raw, timestamp, signature);
    const { eventId, result } = this.provider.parseWebhook(raw);
    const hash = createHash("sha256").update(raw).digest("hex");
    return this.db.transaction(async (tx) => {
      const old = (
        await tx.query(
          "SELECT payload_digest FROM provider_events WHERE provider=$1 AND event_id=$2",
          [provider, eventId],
        )
      ).rows[0];
      if (old) {
        if (old.payload_digest !== hash)
          throw new ConflictException("Event identity conflict");
        return { accepted: true, duplicate: true };
      }
      const inserted = (
        await tx.query(
          "INSERT INTO provider_events(provider,event_id,payload_digest,signature_verified_at,event_type) VALUES($1,$2,$3,now(),$4) ON CONFLICT DO NOTHING RETURNING id",
          [provider, eventId, hash, result.status],
        )
      ).rows[0];
      if (!inserted) throw new ConflictException("Event processing conflict");
      const a = (
        await tx.query(
          "SELECT payout_id FROM payout_attempts WHERE provider=$1 AND provider_request_key=$2",
          [provider, result.requestKey],
        )
      ).rows[0];
      if (a) await this.apply(a.payout_id, result, tx);
      else
        await this.issue(tx, null, "MISSING_INTERNAL", {
          reference: result.reference,
        });
      await tx.query(
        "UPDATE provider_events SET processed_at=now(),processing_result=$2 WHERE id=$1",
        [inserted.id, a ? "PROCESSED" : "MISSING_INTERNAL"],
      );
      return { accepted: true };
    });
  }
  async providerBalance() {
    if (!this.provider.getBalance)
      return {
        supported: false,
        provider: this.provider.name,
        sandbox: this.provider.sandbox,
      };
    const b = await this.provider.getBalance();
    if (!/^\d{1,16}$/.test(b.amountMinor) || !Number.isFinite(Date.parse(b.at)))
      throw new ServiceUnavailableException("Provider balance unavailable");
    const threshold =
      process.env.PAYOUT_BALANCE_WARNING_THRESHOLD ?? "10000000";
    if (!/^\d{1,16}$/.test(threshold)) throw new ServiceUnavailableException();
    const result = {
      supported: true,
      provider: this.provider.name,
      amountInrMinor: b.amountMinor,
      updatedAt: b.at,
      warningThresholdMinor: threshold,
      low: BigInt(b.amountMinor) < BigInt(threshold),
      sandbox: this.provider.sandbox,
    };
    await this.db.query(
      "INSERT INTO system_settings(key,value) VALUES('payout_provider_balance',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now()",
      [JSON.stringify(result)],
    );
    return result;
  }
  async view(id: string, uid?: string) {
    const p = (
      await this.db.query(
        "SELECT * FROM payouts WHERE id=$1 AND ($2::uuid IS NULL OR user_id=$2)",
        [id, uid ?? null],
      )
    ).rows[0];
    if (!p) throw new NotFoundException();
    const b = JSON.parse(
      this.crypto.decrypt(p.beneficiary_snapshot_ciphertext, "payout:" + id),
    );
    return {
      ...(!uid
        ? {
            provider: p.provider,
            failureCode: p.failure_code,
            failureReason: p.failure_reason,
          }
        : {}),
      id: p.id,
      orderId: p.order_id,
      userId: p.user_id,
      status: p.lifecycle,
      amountInrMinor: String(p.amount_inr_minor),
      method: p.rail,
      bank: {
        accountHolderName: b.holder,
        accountNumber: b.maskedAccount,
        ifsc: b.ifsc,
        bankName: b.bank,
      },
      utr: p.utr,
      payoutReference: p.provider_ref,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      completedAt: p.completed_at,
      reversedAt: p.reversed_at,
      sandbox: p.sandbox,
      history: (
        await this.db.query(
          "SELECT status,created_at FROM payout_status_history WHERE payout_id=$1 ORDER BY created_at,id",
          [id],
        )
      ).rows,
    };
  }
}

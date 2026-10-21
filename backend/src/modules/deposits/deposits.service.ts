import { Injectable } from "@nestjs/common";
import { DatabaseService, SqlClient } from "../../common/database.service";
import {
  TronBlockchainProvider,
  ChainTransfer,
} from "../blockchain/tron.provider";
import { requireTransactions } from "../blockchain/chain.config";
import { LedgerService } from "../ledger/ledger.service";
import { OrderTransitionService } from "../orders/order-transition.service";
import { databaseUnits, format } from "../rates/money";
@Injectable()
export class DepositsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly provider: TronBlockchainProvider,
    private readonly ledger: LedgerService,
    private readonly transitions: OrderTransitionService,
  ) {}
  private valid(t: ChainTransfer, hash: string) {
    const c = requireTransactions();
    return (
      t.txHash === hash &&
      t.network === c.network &&
      t.decimals === 6 &&
      this.provider.checkUsdtContract(t.contract) &&
      this.provider.validateAddress(t.receiver) &&
      this.provider.validateAddress(t.sender) &&
      /^[1-9]\d{0,19}$/.test(t.rawAmount) &&
      BigInt(t.rawAmount) > 0n &&
      BigInt(t.rawAmount) < 10n ** 20n &&
      /^(0|[1-9]\d{0,15})$/.test(t.blockNumber) &&
      /^[a-f0-9]{64}$/.test(t.blockHash) &&
      Number.isSafeInteger(t.eventIndex) &&
      t.eventIndex >= 0 &&
      Number.isFinite(Date.parse(t.timestamp)) &&
      Date.parse(t.timestamp) > 0 &&
      Date.parse(t.timestamp) <= Date.now() + 60000
    );
  }
  async review(
    tx: SqlClient,
    uid: string,
    order: string | null,
    hash: string,
    reason: string,
  ) {
    await tx.query(
      "INSERT INTO risk_flags(user_id,order_id,code,severity,sanitized_context,dedupe_key) VALUES($1,$2,$3,'high',$4,$5) ON CONFLICT(dedupe_key) DO NOTHING",
      [
        uid,
        order,
        reason,
        JSON.stringify({ txHash: hash }),
        `chain:${requireTransactions().network}:${hash}:${uid}:${reason}`,
      ],
    );
    if (order) await this.transitions.move(tx, order, "review", reason);
  }
  async inspect(hash: string) {
    if(process.env.MANUAL_DEPOSIT_REVIEW==='true'||process.env.AUTOMATED_BLOCKCHAIN_CREDIT==='false') return;
    const c = requireTransactions();
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("INVALID_TX_HASH");
    const config = (
      await this.db.query(
        "SELECT 1 FROM networks n JOIN token_contracts t ON t.network_code=n.code WHERE n.code=$1 AND n.enabled AND t.enabled AND t.asset_symbol='USDT' AND t.contract_address=$2 AND t.decimals=6",
        [c.network, c.contract],
      )
    ).rows[0];
    if (!config) throw new Error("CHAIN_NOT_PROVISIONED");
    const receipt = await this.provider.getTransaction(hash);
    if (!receipt) {
      await this.holdMissing(hash);
      return;
    }
    if (
      receipt.txHash !== hash ||
      typeof receipt.canonical !== "boolean" ||
      !Array.isArray(receipt.transfers) ||
      receipt.transfers.length > 1000
    )
      throw new Error("INVALID_PROVIDER_RECEIPT");
    const known = (
      await this.db.query(
        "SELECT b.*,d.id deposit_id,d.user_id,x.order_id FROM blockchain_transactions b JOIN deposits d ON d.transaction_id=b.id LEFT JOIN order_deposit_allocations x ON x.deposit_id=d.id WHERE b.network_code=$1 AND b.tx_hash=$2 AND d.status='credited'",
        [c.network, hash],
      )
    ).rows;
    for (const b of known) {
      const canonicalHash = await this.provider.getBlockHash(
        BigInt(b.block_number),
      );
      const proof = receipt.transfers.find(
        (t) => t.eventIndex === b.event_index,
      );
      if (
        !receipt.canonical ||
        receipt.execution !== "SUCCESS" ||
        canonicalHash !== b.block_hash ||
        (proof &&
          (proof.receiver !== b.receiver ||
            proof.contract !== b.contract_address ||
            proof.rawAmount !== b.raw_amount ||
            proof.execution !== "SUCCESS"))
      ) {
        await this.db.transaction(async (tx) => {
          await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
            b.user_id,
          ]);
          await this.reverse(tx, b.user_id, b.order_id ?? null, b, hash);
        });
        return;
      }
      if (!receipt.transfers.some((t) => t.eventIndex === b.event_index)) {
        await this.holdMissing(hash);
        return;
      }
    }
    const head = await this.provider.getLatestBlock();
    const relevant = receipt.transfers.filter((t) =>
      this.provider.checkUsdtContract(t.contract),
    );
    for (const t of receipt.transfers) {
      const a = (
        await this.db.query(
          "SELECT * FROM wallet_addresses WHERE network_code=$1 AND address=$2",
          [c.network, t.receiver],
        )
      ).rows[0];
      if (!a) continue;
      await this.db.transaction(async (tx) => {
        // One user lock serializes wallet spending, matching, reorg reversal and order acceptance.
        await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
          a.user_id,
        ]);
        // Serialize a hash globally, even if multiple transfers target different users.
        await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
          c.network + ":" + hash,
        ]);
        const o = (
          await tx.query(
            "SELECT o.*,q.amount_usdt,q.gross_inr_minor,q.fee_inr_minor FROM sell_orders o JOIN quotes q ON q.id=o.quote_id WHERE o.wallet_address_id=$1 FOR UPDATE OF o",
            [a.id],
          )
        ).rows[0];
        const old = (
          await tx.query(
            "SELECT b.*,d.id deposit_id,d.status deposit_status FROM blockchain_transactions b LEFT JOIN deposits d ON d.transaction_id=b.id WHERE b.network_code=$1 AND b.tx_hash=$2 AND b.event_index=$3 FOR UPDATE OF b",
            [c.network, hash, t.eventIndex],
          )
        ).rows[0];
        const proofChanged =
          old &&
          (old.block_hash !== t.blockHash ||
            String(old.block_number) !== t.blockNumber ||
            old.raw_amount !== t.rawAmount ||
            old.receiver !== t.receiver ||
            old.contract_address !== t.contract);
        if (
          old?.deposit_status === "credited" &&
          (!receipt.canonical ||
            receipt.execution !== "SUCCESS" ||
            t.execution !== "SUCCESS" ||
            proofChanged)
        ) {
          await this.reverse(tx, a.user_id, o?.id ?? null, old, hash);
          return;
        }
        if (
          !this.valid(t, hash) ||
          receipt.execution !== "SUCCESS" ||
          t.execution !== "SUCCESS" ||
          !receipt.canonical ||
          relevant.length !== 1
        ) {
          if (old) {
            await tx.query("UPDATE deposits SET status='review' WHERE id=$1", [
              old.deposit_id,
            ]);
            await tx.query(
              "UPDATE blockchain_transactions SET status='rejected',rejection_reason='INVALID_OR_AMBIGUOUS_TRANSFER',last_checked_at=now() WHERE id=$1",
              [old.id],
            );
          }
          await this.review(
            tx,
            a.user_id,
            o?.id ?? null,
            hash,
            !this.provider.checkUsdtContract(t.contract)
              ? "WRONG_TOKEN"
              : "INVALID_OR_AMBIGUOUS_TRANSFER",
          );
          return;
        }
        if (old?.deposit_status === "credited") {
          const confirmations = Number(
            head >= BigInt(t.blockNumber)
              ? head - BigInt(t.blockNumber) + 1n
              : 0n,
          );
          if (confirmations < old.required_confirmations) {
            await this.reverse(tx, a.user_id, o?.id ?? null, old, hash);
            return;
          }
          await tx.query(
            "UPDATE blockchain_transactions SET last_checked_at=now(),confirmations=$2 WHERE id=$1",
            [old.id, Math.min(confirmations, 2147483647)],
          );
          return;
        }
        if (old && ["review", "reversed"].includes(old.deposit_status)) return;
        const count = Number(
            head >= BigInt(t.blockNumber)
              ? head - BigInt(t.blockNumber) + 1n
              : 0n,
          ),
          confirmations = Math.min(count, 2147483647);
        const required = Math.max(
          c.confirmations,
          o?.required_confirmations ?? 0,
          old?.required_confirmations ?? 0,
        );
        const amount = format(BigInt(t.rawAmount), 6);
        const b =
          old ??
          (
            await tx.query(
              "INSERT INTO blockchain_transactions(network_code,tx_hash,event_index,asset_symbol,contract_address,sender,receiver,raw_amount,amount,block_number,block_hash,block_timestamp,required_confirmations) VALUES($1,$2,$3,'USDT',$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *",
              [
                c.network,
                hash,
                t.eventIndex,
                t.contract,
                t.sender,
                t.receiver,
                t.rawAmount,
                amount,
                t.blockNumber,
                t.blockHash,
                new Date(t.timestamp),
                required,
              ],
            )
          ).rows[0]!;
        const d = (
          await tx.query(
            "INSERT INTO deposits(user_id,wallet_id,wallet_address_id,network_code,asset_symbol,transaction_id,receiver,amount,status) VALUES($1,$2,$3,$4,'USDT',$5,$6,$7,'detected') ON CONFLICT(transaction_id) DO UPDATE SET transaction_id=excluded.transaction_id RETURNING *",
            [a.user_id, a.wallet_id, a.id, c.network, b.id, t.receiver, amount],
          )
        ).rows[0]!;
        let reason: string | null = proofChanged ? "CHAIN_PROOF_CHANGED" : null;
        if (a.retired_at) reason = "RETIRED_ADDRESS";
        if (Date.parse(t.timestamp) < new Date(a.assigned_at).getTime())
          reason = "TRANSFER_PRECEDES_ASSIGNMENT";
        if (o) {
          if (
            [
              "review",
              "expired",
              "cancelled",
              "failed",
              "payout_pending",
            ].includes(o.status)
          )
            reason = "LATE_OR_ADDITIONAL_PAYMENT";
          if (Date.parse(t.timestamp) > new Date(o.funding_deadline).getTime())
            reason = "LATE_PAYMENT";
          if (BigInt(t.rawAmount) !== databaseUnits(o.amount_usdt, 6))
            reason =
              BigInt(t.rawAmount) < databaseUnits(o.amount_usdt, 6)
                ? "UNDERPAYMENT"
                : "OVERPAYMENT";
          const allocated = (
            await tx.query(
              "SELECT deposit_id FROM order_deposit_allocations WHERE order_id=$1",
              [o.id],
            )
          ).rows;
          if (allocated.some((x) => x.deposit_id !== d.id))
            reason = "MULTIPLE_DEPOSITS";
          if (!allocated.length)
            await tx.query(
              "INSERT INTO order_deposit_allocations(order_id,deposit_id,user_id,allocated_amount) VALUES($1,$2,$3,$4)",
              [o.id, d.id, a.user_id, amount],
            );
        } else if (a.purpose === "order") reason = "UNASSIGNED_ORDER_ADDRESS";
        const u = (
          await tx.query(
            "SELECT status,verification_status FROM users WHERE id=$1",
            [a.user_id],
          )
        ).rows[0]!;
        if (u.status !== "active" || u.verification_status !== "verified")
          reason = "ACCOUNT_INELIGIBLE";
        const wallet = (
          await tx.query("SELECT status FROM wallets WHERE id=$1", [
            a.wallet_id,
          ])
        ).rows[0];
        if (wallet?.status !== "active") reason = "WALLET_INELIGIBLE";
        if (
          (
            await tx.query(
              "SELECT id FROM risk_flags WHERE user_id=$1 AND severity IN ('high','critical') AND state<>'resolved' LIMIT 1",
              [a.user_id],
            )
          ).rows.length
        )
          reason = reason ?? "ACCOUNT_REVIEW";
        if (reason) {
          await tx.query("UPDATE deposits SET status='review' WHERE id=$1", [
            d.id,
          ]);
          await tx.query(
            "UPDATE blockchain_transactions SET rejection_reason=$2,last_checked_at=now() WHERE id=$1",
            [b.id, reason],
          );
          await this.review(tx, a.user_id, o?.id ?? null, hash, reason);
          return;
        }
        if (o?.status === "awaiting_funds")
          await this.transitions.move(
            tx,
            o.id,
            "detected",
            "CHAIN_TRANSFER_DETECTED",
          );
        if (o && ["awaiting_funds", "detected"].includes(o.status))
          await this.transitions.move(
            tx,
            o.id,
            "confirming",
            "CHAIN_CONFIRMATIONS",
          );
        await tx.query(
          "UPDATE blockchain_transactions SET confirmations=$2,required_confirmations=GREATEST(required_confirmations,$3),status='confirming',last_checked_at=now() WHERE id=$1",
          [b.id, confirmations, required],
        );
        console.log(JSON.stringify({event:"blockchain_confirmation_staged",txHash:hash,confirmations,requiredConfirmations:required}));
        await tx.query("UPDATE deposits SET status='confirming' WHERE id=$1", [
          d.id,
        ]);
        if (confirmations < required) return;
        const posted = await this.ledger.deposit(tx, { ...d, tx_hash: hash });
        if (!posted) {
          await tx.query("UPDATE deposits SET status='review' WHERE id=$1", [
            d.id,
          ]);
          await this.review(
            tx,
            a.user_id,
            o?.id ?? null,
            hash,
            "HASH_ALREADY_POSTED",
          );
          return;
        }
        await tx.query(
          "UPDATE blockchain_transactions SET status='confirmed',confirmed_at=now() WHERE id=$1",
          [b.id],
        );
        await tx.query(
          "UPDATE deposits SET status='credited',credited_at=now() WHERE id=$1",
          [d.id],
        );
        if (o) {
          await this.ledger.sell(tx, o);
          await this.transitions.move(tx, o.id, "funded", "DEPOSIT_CONFIRMED");
          await this.transitions.move(
            tx,
            o.id,
            "payout_pending",
            "PHASE4_PAYOUT_PENDING",
          );
        }
        await tx.query(
          "INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES('service','blockchain-worker','deposit.credited','deposit',$1,gen_random_uuid(),$2)",
          [d.id, JSON.stringify({ txHash: hash, confirmations })],
        );
      });
      console.log(
        JSON.stringify({
          event: "blockchain_inspection_committed",
          txHash: hash,
          network: c.network,
        }),
      );
    }
  }
  private async reverse(
    tx: SqlClient,
    uid: string,
    order: string | null,
    b: Record<string, any>,
    hash: string,
  ) {
    const exposed=(await tx.query("SELECT p.id,p.order_id FROM payouts p WHERE p.user_id=$1 AND ($2::uuid IS NULL OR p.order_id=$2) AND p.lifecycle NOT IN ('CREATED','QUEUED','CANCELLED','FAILED') FOR UPDATE",[uid,order])).rows;
    if(exposed.length){
      for(const p of exposed){
        await this.review(tx,uid,p.order_id,hash,'CHAIN_REORG_PAYOUT_EXPOSURE');
        await tx.query("INSERT INTO reconciliation_issues(payout_id,issue_type,dedupe_key,status,safe_context) VALUES($1,'CHAIN_REORG_PAYOUT_EXPOSURE',$2,'MANUAL_REVIEW','{}') ON CONFLICT DO NOTHING",[p.id,'reorg-exposure:'+p.id]);
      }
      await tx.query("UPDATE blockchain_transactions SET status='reorged',rejection_reason='PAYOUT_EXPOSURE_REVIEW',last_checked_at=now() WHERE id=$1",[b.id]);
      await tx.query("UPDATE deposits SET status='review' WHERE id=$1",[b.deposit_id]);
      return; // Never unwind a paid/unknown transfer as though bank funds had returned.
    }
    if (order) {
      await this.ledger.reverseSell(tx, order);
      await this.review(tx, uid, order, hash, "CHAIN_REORG");
    } else {
      // Unpaid wallet sells are unwound conservatively before removing a lost wallet credit.
      const orders = (
        await tx.query(
          "SELECT id FROM sell_orders WHERE user_id=$1 AND funding_source='wallet' AND status='payout_pending' ORDER BY id FOR UPDATE",
          [uid],
        )
      ).rows;
      for (const o of orders) {
        await this.ledger.reverseSell(tx, o.id);
        await this.review(tx, uid, o.id, hash, "WALLET_DEPOSIT_REORG");
      }
      await this.review(tx, uid, null, hash, "CHAIN_REORG");
    }
    await this.ledger.reverse(tx, `deposit:${b.network_code}:${hash}`);
    await tx.query("UPDATE deposits SET status='reversed' WHERE id=$1", [
      b.deposit_id,
    ]);
    await tx.query(
      "UPDATE blockchain_transactions SET status='reorged',rejection_reason='CHAIN_REORG',last_checked_at=now() WHERE id=$1",
      [b.id],
    );
  }
  private async holdMissing(hash: string) {
    const rows = (
      await this.db.query(
        "SELECT d.user_id,o.id order_id FROM blockchain_transactions b JOIN deposits d ON d.transaction_id=b.id LEFT JOIN order_deposit_allocations x ON x.deposit_id=d.id LEFT JOIN sell_orders o ON o.id=x.order_id WHERE b.tx_hash=$1 AND b.network_code=$2 AND b.status='confirmed'",
        [hash, requireTransactions().network],
      )
    ).rows;
    for (const r of rows)
      await this.db.transaction(async (tx) => {
        await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
          r.user_id,
        ]);
        await this.review(
          tx,
          r.user_id,
          r.order_id,
          hash,
          "CONFIRMED_RECEIPT_MISSING",
        );
        await tx.query(
          "UPDATE blockchain_transactions SET last_checked_at=now() WHERE tx_hash=$1 AND network_code=$2",
          [hash, requireTransactions().network],
        );
      });
  }
  async expire() {
    const rows = (
      await this.db.query(
        "SELECT id,user_id FROM sell_orders WHERE status='awaiting_funds' AND funding_deadline<now() LIMIT 100",
      )
    ).rows;
    for (const o of rows)
      await this.db.transaction(async (tx) => {
        await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
          o.user_id,
        ]);
        const current = (
          await tx.query(
            "SELECT status FROM sell_orders WHERE id=$1 FOR UPDATE",
            [o.id],
          )
        ).rows[0];
        if (current?.status === "awaiting_funds")
          await this.transitions.move(tx, o.id, "expired", "FUNDING_DEADLINE");
      });
  }
  async stale() {
    const c = requireTransactions(),
      rows = (
        await this.db.query(
          "SELECT d.user_id,b.tx_hash,o.id order_id FROM blockchain_transactions b JOIN deposits d ON d.transaction_id=b.id LEFT JOIN order_deposit_allocations x ON x.deposit_id=d.id LEFT JOIN sell_orders o ON o.id=x.order_id WHERE b.status IN ('detected','confirming') AND d.status<>'review' AND b.observed_at<now()-($1*interval '1 second') LIMIT 100",
          [c.staleSeconds],
        )
      ).rows;
    for (const r of rows)
      await this.db.transaction(async (tx) => {
        await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
          r.user_id,
        ]);
        await this.review(
          tx,
          r.user_id,
          r.order_id,
          r.tx_hash,
          "STALE_CONFIRMATION",
        );
        await tx.query(
          "UPDATE deposits SET status='review' WHERE transaction_id IN (SELECT id FROM blockchain_transactions WHERE tx_hash=$1 AND network_code=$2)",
          [r.tx_hash, c.network],
        );
      });
  }
}

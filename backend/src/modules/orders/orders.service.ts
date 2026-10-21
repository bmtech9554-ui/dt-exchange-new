import {NotificationService} from '../notifications/notification.service';
import { manualDeposits, manualPayouts, manualIdentityOptional, selfDeclaredManualBanks } from '../../config/manual-mode';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { IsUUID } from "class-validator";
import { randomUUID } from "node:crypto";
import { DatabaseService, SqlClient } from "../../common/database.service";
import { SecurityService } from "../../common/security.service";
import { WalletsService } from "../wallets/wallets.service";
import { RatesService } from "../rates/rates.service";
import { databaseUnits } from "../rates/money";
import { LedgerService } from "../ledger/ledger.service";
import { LimitsService } from "./limits.service";
import {
  OrderTransitionService,
  publicStatus,
} from "./order-transition.service";
import { requireTransactions, chainConfig } from "../blockchain/chain.config";
export class CreateOrderDto {
  @IsUUID() quoteId!: string;
  @IsUUID() bankAccountId!: string;
}
@Injectable()
export class OrdersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly security: SecurityService,
    private readonly wallets: WalletsService,
    private readonly rates: RatesService,
    private readonly limits: LimitsService,
    private readonly ledger: LedgerService,
    private readonly transitions: OrderTransitionService,
    private readonly notifications: NotificationService,
  ) {}
  async create(uid: string, dto: CreateOrderDto, key?: string) {
    const config = requireTransactions();
    await this.security.limit("orders:" + uid, 20, 60);
    return this.security.idempotent(uid, "sell.order", key, dto, async (tx) => {
      const q = (
        await tx.query(
          "SELECT q.*,s.status FROM quotes q JOIN quote_states s ON s.quote_id=q.id WHERE q.id=$1 AND q.user_id=$2 FOR UPDATE OF q,s",
          [dto.quoteId, uid],
        )
      ).rows[0];
      if (!q) throw new NotFoundException("Quote not found");
      if(manualDeposits() && q.funding_source!=="wallet") throw new BadRequestException("Manual mode requires approved wallet balance");
      if (q.status !== "ACTIVE" || new Date(q.expires_at) <= new Date())
        throw new BadRequestException("Quote expired or already used");
      if (q.bank_account_id !== dto.bankAccountId)
        throw new BadRequestException("Bank differs from quote");
      const b = (
        await tx.query(
          `SELECT id FROM bank_accounts WHERE id=$1 AND user_id=$2 AND disabled_at IS NULL AND (verification_status='verified' ${selfDeclaredManualBanks()&&q.funding_source==='wallet'?'OR self_declared':''}) FOR UPDATE`,
          [dto.bankAccountId, uid],
        )
      ).rows[0];
      if (!b) throw new BadRequestException("Available bank account required");
      await this.limits.enforce(
        tx,
        uid,
        databaseUnits(q.amount_usdt, 6),
        await this.rates.policy(tx),
        q.id,
      );
      if (
        q.funding_source === "wallet" &&
        !(
          await tx.query(
            "SELECT id FROM wallets WHERE user_id=$1 AND asset_symbol='USDT' AND status='active'",
            [uid],
          )
        ).rows.length
      )
        throw new BadRequestException("Wallet unavailable");
      const address =
        q.funding_source === "onchain"
          ? await this.wallets.allocate(tx, uid, `order-${q.id}`, "order")
          : null;
      await this.transitions.actor(tx, uid, "user", "QUOTE_ACCEPTED");
      // Transaction-local: cannot carry over to another pooled request.
      await tx.query("SELECT set_config('dt.manual_identity_optional',$1,true)", [
        manualIdentityOptional() && q.funding_source === "wallet" ? "on" : "off",
      ]);
      const id = randomUUID();
      const o = (
        await tx.query(
          "INSERT INTO sell_orders(id,order_number,user_id,quote_id,bank_account_id,funding_source,funding_deadline,wallet_address_id,required_confirmations,sandbox) VALUES($1,$2,$3,$4,$5,$6,now()+($7*interval '1 second'),$8,$9,$10) RETURNING *",
          [
            id,
            "DT-" + id.replaceAll("-", "").toUpperCase(),
            uid,
            q.id,
            b.id,
            q.funding_source,
            config.orderExpiry,
            address?.id ?? null,
            config.confirmations,
            config.sandbox,
          ],
        )
      ).rows[0]!;
      if (q.funding_source === "wallet") {
        await this.ledger.sell(tx, { ...q, ...o });
        await this.transitions.move(
          tx,
          id,
          "funded",
          "LEDGER_BALANCE_RESERVED",
        );
        await this.transitions.move(
          tx,
          id,
          "payout_pending",
          "PHASE4_PAYOUT_PENDING",
        );
      }
      if(manualDeposits()) await this.notifications.create(tx,uid,'manual-order:'+id,'SELL_ORDER','Sell Order Created','Your approved USDT has been reserved for INR payout.','/history');
      return this.detail(tx, uid, id);
    });
  }
  async get(uid: string, id: string) {
    return this.detail(this.db, uid, id);
  }
  async detail(tx: SqlClient, uid: string, id: string) {
    const o = (
      await tx.query(
        `SELECT o.*,EXISTS(SELECT 1 FROM manual_order_refunds r WHERE r.order_id=o.id) wallet_refunded,u.public_user_id::text,q.amount_usdt,q.rate_inr,q.fee_inr_minor,q.net_inr_minor,a.address,a.network_code FROM sell_orders o JOIN users u ON u.id=o.user_id JOIN quotes q ON q.id=o.quote_id LEFT JOIN wallet_addresses a ON a.id=o.wallet_address_id WHERE o.id=$1 AND o.user_id=$2`,
        [id, uid],
      )
    ).rows[0];
    if (!o) throw new NotFoundException();
    const chain = (
      await tx.query(
        "SELECT b.tx_hash,b.confirmations,b.block_number,b.status FROM order_deposit_allocations x JOIN deposits d ON d.id=x.deposit_id JOIN blockchain_transactions b ON b.id=d.transaction_id WHERE x.order_id=$1",
        [id],
      )
    ).rows[0];
    const timeline = (
      await tx.query(
        "SELECT to_status,created_at FROM order_status_history WHERE order_id=$1 ORDER BY version",
        [id],
      )
    ).rows.map((x) => ({
      status: publicStatus[x.to_status],
      at: x.created_at,
    }));
    const payout=(await tx.query("SELECT id,lifecycle,utr,provider_ref,completed_at,sandbox,manual_receipt_id,manual_paid_at,provider FROM payouts WHERE order_id=$1",[id])).rows[0];
    return {
      payout: payout ? {id:payout.id,status:payout.lifecycle,utr:payout.utr,payoutReference:payout.provider_ref,completedAt:payout.completed_at,sandbox:payout.sandbox,receiptId:payout.manual_receipt_id,paidAt:payout.manual_paid_at,manual:payout.provider==='manual'} : null,
      payoutsEnabled: process.env.PAYOUTS_ENABLED==='true',
      completedAt: o.completed_at,
      orderId: o.id,
      orderNumber: o.order_number,
      quoteId: o.quote_id,
      status: publicStatus[o.status],
      walletRefunded: o.wallet_refunded === true,
      amountUsdt: o.amount_usdt,
      exchangeRate: o.rate_inr,
      feeInrMinor: String(o.fee_inr_minor),
      finalInrMinor: String(o.net_inr_minor),
      bankAccountId: o.bank_account_id,
      fundingSource: o.funding_source,
      depositAddress: o.address ?? null,
      qrPayload: o.address ?? null,
      network: "TRC20",
      chainNetwork: o.network_code ?? null,
      txHash: chain?.tx_hash ?? null,
      confirmations: chain?.confirmations ?? 0,
      requiredConfirmations: Math.max(
        o.required_confirmations,
        chainConfig().confirmations,
      ),
      createdAt: o.accepted_at,
      updatedAt: o.updated_at,
      expiresAt: o.funding_deadline,
      timeline,
      sandbox: o.sandbox,
      payoutExecuted: payout?.lifecycle === "SUCCESS" && !payout.sandbox,
    };
  }
}

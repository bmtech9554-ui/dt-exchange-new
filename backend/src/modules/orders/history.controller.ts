import {
  Controller,
  Get,
  Req,
  Query,
  Param,
  ParseUUIDPipe,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { CryptoService } from "../../common/crypto.service";
import { AuthRequest } from "../../common/auth.guard";
import { OrdersService } from "./orders.service";
import { DatabaseService } from "../../common/database.service";
@Controller(["history", "transactions"])
export class HistoryController {
  constructor(
    private readonly db: DatabaseService,
    private readonly orders: OrdersService,
    private readonly crypto: CryptoService,
  ) {}
  @Get(":id") async detail(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const o = (
      await this.db.query(
        "SELECT id FROM sell_orders WHERE id=$1 AND user_id=$2",
        [id, r.user.userId],
      )
    ).rows[0];
    if (o)
      return { type: "sell", ...(await this.orders.get(r.user.userId, id)) };
    const d = (
      await this.db.query(
        `SELECT d.id,d.status,d.amount::text amount_usdt,d.created_at,b.tx_hash,b.confirmations,b.required_confirmations,b.block_number::text,a.address FROM deposits d JOIN blockchain_transactions b ON b.id=d.transaction_id JOIN wallet_addresses a ON a.id=d.wallet_address_id WHERE d.id=$1 AND d.user_id=$2`,
        [id, r.user.userId],
      )
    ).rows[0];
    if (!d) {
      const manual=(await this.db.query("SELECT id,submitted_amount::text amount_usdt,verified_amount::text,status,tx_hash,receiver,created_at,reason FROM manual_deposit_requests WHERE id=$1 AND user_id=$2",[id,r.user.userId])).rows[0];
      if(manual)return {...manual,type:"deposits",network:"TRC20",manual:true};
      const payout=(await this.db.query("SELECT p.id,p.order_id,p.amount_inr_minor::text,p.lifecycle status,p.utr,p.provider_ref payout_reference,p.created_at,p.completed_at,p.sandbox,p.manual_receipt_id,p.manual_paid_at,p.beneficiary_snapshot_ciphertext,q.amount_usdt::text,q.rate_inr::text FROM payouts p JOIN sell_orders o ON o.id=p.order_id JOIN quotes q ON q.id=o.quote_id WHERE p.id=$1 AND p.user_id=$2",[id,r.user.userId])).rows[0];
      if(payout){const b=JSON.parse(this.crypto.decrypt(payout.beneficiary_snapshot_ciphertext,'payout:'+id));const {beneficiary_snapshot_ciphertext,...safe}=payout;return {...safe,type:'payouts',bank:{accountNumber:b.maskedAccount,bankName:b.bank,ifsc:b.ifsc}};}
      throw new NotFoundException();
    }
    return { ...d, type: "deposits", network: "TRC20" };
  }
  @Get() async list(
    @Req() r: AuthRequest,
    @Query("type") type = "all",
    @Query("status") status?: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    if (
      !["all", "deposits", "sell", "payouts"].includes(type) ||
      !/^\d{1,5}$/.test(page) ||
      !/^\d{1,3}$/.test(limit) ||
      +page < 1 ||
      +limit < 1 ||
      +limit > 100 ||
      (status && !/^[a-z_]{1,30}$/.test(status))
    )
      throw new BadRequestException("Invalid history filter");
    const rows = (
      await this.db.query(
        `WITH history AS (
   SELECT o.id,'sell' type,q.amount_usdt::text amount_usdt,q.net_inr_minor::text inr_minor,o.status::text status,o.accepted_at created_at FROM sell_orders o JOIN quotes q ON q.id=o.quote_id WHERE o.user_id=$1
   UNION ALL SELECT d.id,'deposits',d.amount::text,NULL,d.status,d.created_at FROM deposits d WHERE d.user_id=$1
   UNION ALL SELECT m.id,'deposits',coalesce(m.verified_amount,m.submitted_amount)::text,NULL,lower(m.status),m.created_at FROM manual_deposit_requests m WHERE m.user_id=$1
   UNION ALL SELECT p.id,'payouts',NULL,p.amount_inr_minor::text,lower(p.lifecycle),p.created_at FROM payouts p WHERE p.user_id=$1
  ), filtered AS (
    SELECT * FROM history WHERE ($2='all' OR type=$2) AND ($3::text IS NULL OR status=$3)
  ), page AS (
    SELECT * FROM filtered ORDER BY created_at DESC,id DESC LIMIT $4 OFFSET $5
  )
  SELECT page.*, totals.total FROM (SELECT count(*)::int total FROM filtered) totals
  LEFT JOIN page ON true ORDER BY page.created_at DESC,page.id DESC`,
        [r.user.userId, type, status ?? null, +limit, (+page - 1) * +limit],
      )
    ).rows;
    return {
      items: rows.filter((row) => row.id !== null).map(({ total, ...x }) => x),
      page: +page,
      limit: +limit,
      total: rows[0]?.total ?? 0,
      hasMore: +page * +limit < (rows[0]?.total ?? 0),
    };
  }
}

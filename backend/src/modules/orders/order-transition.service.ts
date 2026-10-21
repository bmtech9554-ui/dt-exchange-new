import { Injectable, ConflictException } from "@nestjs/common";
import { SqlClient } from "../../common/database.service";
export const publicStatus: Record<string, string> = {
  awaiting_funds: "AWAITING_DEPOSIT",
  detected: "DEPOSIT_DETECTED",
  confirming: "BLOCKCHAIN_CONFIRMING",
  funded: "DEPOSIT_CONFIRMED",
  payout_pending: "READY_FOR_PAYOUT",
  review: "MANUAL_REVIEW",
  expired: "EXPIRED",
  cancelled: "CANCELLED",
  failed: "FAILED",
  payout_processing: "PAYOUT_PROCESSING",
  completed: "COMPLETED",
};
const allowed: Record<string, string[]> = {
  awaiting_funds: [
    "detected",
    "funded",
    "expired",
    "cancelled",
    "review",
    "failed",
  ],
  detected: ["confirming", "review", "failed", "expired"],
  confirming: ["funded", "review", "failed"],
  funded: ["payout_pending", "review"],
  payout_pending: ["review", "payout_processing"],
  payout_processing: ["completed", "failed", "review"],
  completed: ["review"],
  expired: ["review"],
  cancelled: ["review"],
  failed: ["review", "payout_pending", "cancelled"],
  // SQL additionally requires evidenced manual settlement for this transition.
  review: ["completed", "failed", "cancelled"],
};
@Injectable()
export class OrderTransitionService {
  async actor(
    tx: SqlClient,
    id: string,
    kind = "service",
    reason = "SERVER_TRANSITION",
  ) {
    await tx.query(
      "SELECT set_config('dt.actor_id',$1,true),set_config('dt.actor_type',$2,true),set_config('dt.transition_reason',$3,true)",
      [id, kind, reason],
    );
  }
  async move(tx: SqlClient, id: string, to: string, reason: string, actor?: {id:string;kind:string}) {
    const row = (
      await tx.query("SELECT status FROM sell_orders WHERE id=$1 FOR UPDATE", [
        id,
      ])
    ).rows[0];
    if (row?.status === to) return;
    if (!row || !allowed[row.status]?.includes(to))
      throw new ConflictException("Illegal order transition");
    await this.actor(tx, actor?.id ?? "blockchain-worker", actor?.kind ?? "service", reason);
    await tx.query(
      "UPDATE sell_orders SET status=$2::sell_status,funded_at=CASE WHEN $2::text='funded' THEN now() ELSE funded_at END,completed_at=CASE WHEN $2::text='completed' THEN now() ELSE completed_at END,review_reason=CASE WHEN $2::text='review' THEN $3 ELSE review_reason END WHERE id=$1",
      [id, to, reason],
    );
    console.log(JSON.stringify({event:"order_transition_staged",orderId:id,status:to,reason}));
  }
}

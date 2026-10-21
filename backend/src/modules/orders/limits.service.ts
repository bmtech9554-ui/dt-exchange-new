import { manualIdentityOptional } from "../../config/manual-mode";
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { SqlClient } from "../../common/database.service";
import { databaseUnits } from "../rates/money";
@Injectable()
export class LimitsService {
  async enforce(
    tx: SqlClient,
    uid: string,
    amount: bigint,
    p: Record<string, any>,
    excludeQuoteId?: string,
  ) {
    const u = (
      await tx.query(
        "SELECT status,verification_status FROM users WHERE id=$1 FOR UPDATE",
        [uid],
      )
    ).rows[0];
    if (
      u?.status !== "active" ||
      (!manualIdentityOptional() &&
        u.verification_status !== "verified")
    )
      throw new ForbiddenException(
        "Account is not eligible for this operation",
      );
    if (
      (
        await tx.query(
          "SELECT id FROM risk_flags WHERE user_id=$1 AND state<>'resolved' AND severity IN ('high','critical') LIMIT 1",
          [uid],
        )
      ).rows.length
    )
      throw new ForbiddenException("Account review required");
    const override = (
      await tx.query("SELECT * FROM user_limits WHERE user_id=$1", [uid])
    ).rows[0];
    if (p.daily_limit == null || p.monthly_limit == null)
      throw new ServiceUnavailableException('Daily and monthly sell limits require configuration');
    const cap = (key: string) => {
      const global = databaseUnits(p[key], 6);
      return override
        ? global < databaseUnits(override[key], 6)
          ? global
          : databaseUnits(override[key], 6)
        : global;
    };
    if (
      amount < databaseUnits(p.minimum_sell, 6) ||
      amount > cap("maximum_sell")
    )
      throw new BadRequestException("Amount outside transaction limits");
    // Active quotes reserve eligibility for their brief lifetime; accepted orders count once.
    const usage = (
      await tx.query(
        `WITH usage AS (
   SELECT q.amount_usdt amount,o.accepted_at at FROM sell_orders o JOIN quotes q ON q.id=o.quote_id WHERE o.user_id=$1 AND o.status NOT IN ('cancelled','expired','failed')
   UNION ALL SELECT q.amount_usdt,q.created_at FROM quotes q JOIN quote_states s ON s.quote_id=q.id WHERE q.user_id=$1 AND s.status='ACTIVE' AND q.expires_at>now() AND ($2::uuid IS NULL OR q.id<>$2)
  ) SELECT coalesce(sum(amount) FILTER(WHERE at >= date_trunc('day',now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'),0)::text daily,coalesce(sum(amount) FILTER(WHERE at >= date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'),0)::text monthly FROM usage`,
        [uid, excludeQuoteId ?? null],
      )
    ).rows[0]!;
    if (databaseUnits(usage.daily, 6) + amount > cap("daily_limit"))
      throw new BadRequestException("Daily limit exceeded");
    if (databaseUnits(usage.monthly, 6) + amount > cap("monthly_limit"))
      throw new BadRequestException("Monthly limit exceeded");
  }
}

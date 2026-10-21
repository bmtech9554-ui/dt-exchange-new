import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { DatabaseService, SqlClient } from "../../common/database.service";
import { RateProvider } from "./rate.provider";
import { calculateRate, decimal, format } from "./money";
@Injectable()
export class RatesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly provider: RateProvider,
  ) {}
  async policy(tx: SqlClient = this.db) {
    const p = (
      await tx.query(
        "SELECT p.*,f.flat_inr_minor,f.basis_points FROM rate_policies p JOIN fees f ON f.id=p.fee_id WHERE p.effective_from<=now() AND (p.retired_at IS NULL OR p.retired_at>now()) AND f.effective_from<=now() AND (f.retired_at IS NULL OR f.retired_at>now()) ORDER BY p.version DESC LIMIT 1",
      )
    ).rows[0];
    if (!p) throw new ServiceUnavailableException("Rate policy not configured");
    return p;
  }
  async snapshot(tx: SqlClient = this.db) {
    const p = await this.policy(tx);
    const m =
      p.mode === "manual"
        ? {
            rate: p.manual_rate,
            source: "MANUAL_ADMIN",
            observedAt: new Date(),
            sandbox: false,
          }
        : await this.provider.fetch();
    const age = Date.now() - m.observedAt.getTime();
    if (age < -5000 || age > p.maximum_rate_age_seconds * 1000)
      throw new ServiceUnavailableException("Rate unavailable");
    const effective = calculateRate(
        decimal(m.rate, 8),
        p.mode,
        p.manual_rate ? decimal(p.manual_rate, 8) : null,
        p.margin_bps,
        p.spread_bps,
      ),
      expiry = new Date(
        Math.min(
          Date.now() + p.quote_expiry_seconds * 1000,
          m.observedAt.getTime() + p.maximum_rate_age_seconds * 1000,
        ),
      );
    const row = (
      await tx.query(
        "INSERT INTO exchange_rates(base_asset,quote_asset,mode,market_rate,effective_rate,margin_bps,source,observed_at,expires_at) VALUES('USDT','INR',$1,$2,$3,$4,$5,$6,$7) RETURNING id",
        [
          p.mode,
          p.mode === "manual" ? null : m.rate,
          format(effective, 8),
          p.margin_bps,
          m.source,
          m.observedAt,
          expiry,
        ],
      )
    ).rows[0]!;
    return {
      policy: p,
      id: row.id,
      marketRate: p.mode === "manual" ? null : m.rate,
      exchangeRate: format(effective, 8),
      marginBps: p.margin_bps,
      spreadBps: p.spread_bps,
      fixedFeeInrMinor: String(p.flat_inr_minor),
      feeBasisPoints: p.basis_points,
      source: m.source,
      rateLastUpdatedAt: p.effective_from ? new Date(p.effective_from).toISOString() : null,
      policyVersion: p.version,
      timestamp: m.observedAt.toISOString(),
      validUntil: expiry.toISOString(),
      sandbox: m.sandbox,
    };
  }
  async current() {
    const { policy, ...rate } = await this.snapshot();
    return {
      ...rate,
      quotesConfigured: policy.daily_limit != null && policy.monthly_limit != null,
      minimumSell: policy.minimum_sell,
      maximumSell: policy.maximum_sell,
      dailyLimit: policy.daily_limit,
      monthlyLimit: policy.monthly_limit,
    };
  }
}

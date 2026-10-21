import { Injectable } from "@nestjs/common";
import { DatabaseService } from "./database.service";
/** Bounded cardinality hook; integrations can export these observations to any backend. */
@Injectable()
export class ObservabilityService {
  constructor(private readonly db: DatabaseService) {}
  async observe(
    name: string,
    value: number,
    labels: Record<string, string> = {},
  ) {
    if (process.env.METRICS_ENABLED === "false") return;
    if (!/^[a-z_]{1,50}$/.test(name) || !Number.isFinite(value)) return;
    const safe = Object.fromEntries(
      Object.entries(labels).filter(
        ([k, v]) =>
          ["result", "provider", "operation"].includes(k) &&
          /^[a-zA-Z0-9_-]{1,40}$/.test(v),
      ),
    );
    try {
      await this.db.query(
        "INSERT INTO metric_samples(name,value,labels) VALUES($1,$2,$3)",
        [name, value, JSON.stringify(safe)],
      );
    } catch {
      console.error(JSON.stringify({ event: "metrics_unavailable" }));
    }
  }
  /** Only safe reads or provider-idempotent operations. Callers must honor AbortSignal. */
  async safeProviderCall<T>(
    provider: string,
    operation: (signal: AbortSignal) => Promise<T>,
    timeoutMs = 10000,
  ): Promise<T> {
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(provider))
      throw new Error("INVALID_PROVIDER");
    const c = (
      await this.db.query(
        "SELECT opened_until FROM provider_circuits WHERE provider=$1",
        [provider],
      )
    ).rows[0];
    if (c?.opened_until && new Date(c.opened_until) > new Date())
      throw new Error("PROVIDER_CIRCUIT_OPEN");
    const signal = AbortSignal.timeout(timeoutMs);
    const start = Date.now();
    let rejectTimeout: () => void = () => {};
    const expired = new Promise<never>((_, reject) => {
      rejectTimeout = () => reject(new Error("PROVIDER_TIMEOUT"));
      signal.addEventListener("abort", rejectTimeout, { once: true });
    });
    try {
      const result = await Promise.race([operation(signal), expired]);
      await this.db.query("DELETE FROM provider_circuits WHERE provider=$1", [
        provider,
      ]);
      await this.observe("provider_duration_ms", Date.now() - start, {
        provider,
        result: "ok",
      });
      return result;
    } catch {
      await this.db.query(
        "INSERT INTO provider_circuits(provider,failures) VALUES($1,1) ON CONFLICT(provider) DO UPDATE SET failures=provider_circuits.failures+1,opened_until=CASE WHEN provider_circuits.failures>=4 THEN now()+interval '60 seconds' ELSE NULL END",
        [provider],
      );
      await this.observe("provider_failures", 1, {
        provider,
        result: "failed",
      });
      throw new Error("PROVIDER_UNAVAILABLE");
    } finally {
      signal.removeEventListener("abort", rejectTimeout);
    }
  }
}

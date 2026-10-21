import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { Queue } from "bullmq";
import { DatabaseService } from "../common/database.service";
import { manualDeposits, manualPayouts } from "../config/manual-mode";
import { redisConnection,engagementQueueName,queuePrefix } from "../common/queue-config";
@Controller("health")
export class HealthController {
  constructor(private readonly database: DatabaseService) {}
  @Get() health() {
    return this.live();
  }
  @Get("live") live() {
    return { status: "ok", service: "dt-exchange-api", phase: 7 };
  }
  @Get("ready") async ready() {
    const database = await this.database.ready();
    let redis = "not_configured",
      queues = "not_checked";
    if (process.env.REDIS_URL) {
      const queue = new Queue(engagementQueueName(), {
        prefix: queuePrefix(),
        connection: {
          ...redisConnection(),
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        },
      });
      queue.on("error", () => {});
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          queue.getJobCounts("waiting", "failed", "active"),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error("TIMEOUT")), 2500);
          }),
        ]);
        redis = "ready";
        queues = "ready";
      } catch {
        redis = "unavailable";
        queues = "unavailable";
      } finally {
        clearTimeout(timer);
        await queue.disconnect();
      }
    }
    const required =
      process.env.NODE_ENV === "production" ||
      process.env.HEALTH_REQUIRE_WORKERS === "true";
    let workers = "not_required";
    if (required && database) {
      const names = [
        "engagement",
        ...(process.env.TRANSACTIONS_ENABLED === "true" && !manualDeposits() ? ["blockchain"] : []),
        ...(process.env.PAYOUTS_ENABLED === "true" && !manualPayouts() ? ["payouts"] : []),
      ];
      const rows = (
        await this.database.query(
          "SELECT worker FROM worker_heartbeats WHERE state='ok' AND last_seen_at>now()-interval '2 minutes' AND worker=ANY($1::text[])",
          [names],
        )
      ).rows;
      workers = rows.length === names.length ? "ready" : "unavailable";
    }
    const ready =
      database &&
      (!required || (redis === "ready" && workers === "ready")) &&
      redis !== "unavailable";
    const result = {
      status: ready ? "ready" : "not_ready",
      database: database ? "ready" : "unavailable_or_unmigrated",
      redis,
      queues,
      workers,
      providerConnectivity:
        "worker_observed; external credentials require deployment validation",
    };
    if (!ready) throw new ServiceUnavailableException(result);
    return result;
  }
}

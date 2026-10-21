import {queuePrefix} from './common/queue-config';
import {registerWorkerShutdown} from './common/worker-shutdown';
import "reflect-metadata";
import { ObservabilityService } from "./common/observability.service";
import { NestFactory } from "@nestjs/core";
import { Queue, Worker } from "bullmq";
import { AppModule } from "./app.module";
import { DatabaseService } from "./common/database.service";
import { NotificationService } from "./modules/notifications/notification.service";
import { ReferralsService } from "./modules/referrals/referrals.service";
import { redisConnection, reliableJobs, engagementQueueName } from "./common/queue-config";
async function main() {
  const connection = redisConnection();
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get(DatabaseService),
    notices = app.get(NotificationService),
    referrals = app.get(ReferralsService);
  const queue = new Queue(engagementQueueName(), {
    connection,
    prefix: queuePrefix(),
    defaultJobOptions: reliableJobs,
  });
  const worker = new Worker(
    engagementQueueName(),
    async (job) => {
      const started = Date.now();
      if (job.name === "dispatch") {
        await notices.fanout();
        await referrals.reviewExposure();
        const counts = await queue.getJobCounts("waiting", "failed");
        await app
          .get(ObservabilityService)
          .observe("queue_depth", counts.waiting ?? 0, {
            operation: "engagement",
          });
        await app
          .get(ObservabilityService)
          .observe("failed_jobs", counts.failed ?? 0, {
            operation: "engagement",
          });
        await db.query(
          "DELETE FROM metric_samples WHERE created_at<now()-interval '7 days'",
        );
        const bucket = Math.floor(Date.now() / 30000);
        for (const d of (
          await db.query(
            "SELECT id FROM notification_deliveries WHERE status IN ('QUEUED','FAILED') AND attempt_count<5 AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY created_at LIMIT 100",
          )
        ).rows)
          await queue.add(
            "deliver",
            { id: d.id },
            { jobId: `delivery-${d.id}-${bucket}` },
          );
        for (const r of (
          await db.query(
            "SELECT r.id FROM referrals r WHERE lifecycle IN ('REGISTERED','QUALIFIED') AND NOT review_required AND EXISTS(SELECT 1 FROM sell_orders o WHERE o.user_id=r.referred_user_id AND o.status='completed') ORDER BY r.reward_checked_at NULLS FIRST,r.created_at LIMIT 100",
          )
        ).rows)
          await queue.add(
            "reward",
            { id: r.id },
            { jobId: `reward-${r.id}-${bucket}` },
          );
      } else if (job.name === "deliver") await notices.deliver(job.data.id);
      else if (job.name === "reward") await referrals.reward(job.data.id);
      else throw new Error("UNKNOWN_JOB");
      await db.query(
        "INSERT INTO worker_heartbeats(worker,last_seen_at,state) VALUES('engagement',now(),'ok') ON CONFLICT(worker) DO UPDATE SET last_seen_at=now(),state='ok'",
      );
      console.log(
        JSON.stringify({
          event: "worker_complete",
          workerJobId: job.id,
          operation: job.name,
          duration: Date.now() - started,
          result: "ok",
        }),
      );
    },
    { connection, prefix: queuePrefix(), concurrency: 4, lockDuration: 60000 },
  );
  worker.on("error", () =>
    console.error(
      JSON.stringify({ event: "engagement_worker_connection_error" }),
    ),
  );
  worker.on("failed", (job) => {
    if (job)
      void db
        .query(
          "INSERT INTO worker_failures(job_id,job_name,safe_context,failure_code,attempts) VALUES($1,$2,$3,'ENGAGEMENT_JOB_FAILED',$4) ON CONFLICT(job_id) DO UPDATE SET attempts=excluded.attempts",
          [
            "engagement:" + job.id,
            job.name,
            JSON.stringify({ entityId: job.data?.id ?? null }),
            job.attemptsMade,
          ],
        )
        .catch(() =>
          console.error(
            JSON.stringify({ event: "failure_record_unavailable" }),
          ),
        );
  });
  await queue.upsertJobScheduler(
    "dispatch",
    { every: 30000 },
    { name: "dispatch", data: {} },
  );
  registerWorkerShutdown(async()=>{await worker.close();await queue.close();await app.close();});
}
void main().catch(() => {
  console.error(JSON.stringify({ event: "engagement_worker_failed" }));
  process.exitCode = 1;
});

import {queuePrefix} from './common/queue-config';
import {registerWorkerShutdown} from './common/worker-shutdown';
import { redisConnection } from './common/queue-config';
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Queue, Worker } from "bullmq";
import { AppModule } from "./app.module";
import { DatabaseService } from "./common/database.service";
import { PayoutsService } from "./modules/payouts/payouts.service";
import {
  PayoutProvider,
  payoutConfig,
} from "./modules/payouts/payout.provider";
async function main() {
  if (process.env.MANUAL_PAYOUT === "true") throw new Error("AUTOMATIC_WORKER_DISABLED_IN_MANUAL_MODE");
  const c = payoutConfig();
  if (!c.enabled) throw new Error("PAYOUTS_DISABLED");
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get(DatabaseService),
    service = app.get(PayoutsService),
    provider = app.get(PayoutProvider);
  if (!process.env.REDIS_URL) throw new Error("REDIS_REQUIRED");
  const connection = redisConnection();
  const queue = new Queue("dt-payouts", {
    connection,
    prefix: queuePrefix(),
    defaultJobOptions: {
      attempts: Math.max(1, c.retries + 1),
      backoff: { type: "exponential", delay: c.retryDelay },
      removeOnComplete: { age: 3600, count: 5000 },
      removeOnFail: false,
    },
  });
  const worker = new Worker(
    "dt-payouts",
    async (job) => {
      if (job.name === "dispatch") {
        const ready = (
          await db.query(
            "SELECT id FROM sell_orders WHERE status='payout_pending' AND NOT EXISTS(SELECT 1 FROM payouts p WHERE p.order_id=sell_orders.id) ORDER BY updated_at LIMIT 100",
          )
        ).rows;
        for (const o of ready) {
          try {
            await service.create(o.id);
          } catch {
            await db.transaction(async (tx) => {
              await service.audit(tx, o.id, "payout.eligibility_review");
              await tx.query(
                "INSERT INTO risk_flags(user_id,order_id,code,severity,dedupe_key) SELECT user_id,id,'PAYOUT_ELIGIBILITY','high',$2 FROM sell_orders WHERE id=$1 ON CONFLICT(dedupe_key) DO NOTHING",
                [o.id, "payout-eligibility:" + o.id],
              );
            });
          }
        }
        const events = (
          await db.query(
            "SELECT * FROM outbox_events WHERE event_type='payout.submit' AND published_at IS NULL AND available_at<=now() ORDER BY created_at LIMIT 100",
          )
        ).rows;
        for (const e of events) {
          await queue.add("submit", e.payload, { jobId: e.id });
          await db.query(
            "UPDATE outbox_events SET published_at=now() WHERE id=$1",
            [e.id],
          );
        }
        const retryable = (
          await db.query(
            "SELECT p.id FROM payouts p JOIN payout_attempts a ON a.payout_id=p.id WHERE p.lifecycle='FAILED' AND a.attempt_number=(SELECT max(attempt_number) FROM payout_attempts WHERE payout_id=p.id) AND a.response_code='TRANSIENT_NOT_ACCEPTED' AND a.definitive_failure AND a.attempt_number<=$1 AND a.resolved_at<now()-($2*interval '1 millisecond') LIMIT 100",
            [c.retries, c.retryDelay],
          )
        ).rows;
        for (const p of retryable) {
          try {
            await service.retry(
              p.id,
              "payout-worker",
              "TRANSIENT_NOT_ACCEPTED",
              "service",
            );
          } catch {
            await service.markStale(p.id);
          }
        }
        const pending = (
          await db.query(
            "SELECT id FROM payouts WHERE lifecycle IN ('SUBMITTED','PROCESSING','MANUAL_REVIEW','SUCCESS') AND (last_checked_at IS NULL OR last_checked_at<now()-($1*interval '1 millisecond')) ORDER BY last_checked_at NULLS FIRST LIMIT 100",
            [c.poll],
          )
        ).rows;
        for (const p of pending)
          await queue.add(
            "refresh",
            { payoutId: p.id },
            { jobId: `refresh-${p.id}-${Math.floor(Date.now() / c.poll)}` },
          );
        // Re-dispatch queued records even when Redis lost an acknowledged outbox job.
        for (const p of (
          await db.query(
            "SELECT id FROM payouts WHERE lifecycle='QUEUED' ORDER BY created_at LIMIT 100",
          )
        ).rows)
          await queue.add(
            "submit",
            { payoutId: p.id },
            { jobId: `recover-${p.id}-${Math.floor(Date.now() / c.poll)}` },
          );
      } else if (job.name === "submit") await service.submit(job.data.payoutId);
      else if (job.name === "refresh") await service.refresh(job.data.payoutId);
      else if (job.name === "reconcile") {
        await service.providerBalance();
        for (const p of (
          await db.query(
            "SELECT id FROM payouts ORDER BY last_reconciled_at NULLS FIRST,id LIMIT 1000",
          )
        ).rows)
          await service.reconcile(p.id);
        if (provider.listPayouts)
          for (const r of await provider.listPayouts()) {
            const a = (
              await db.query(
                "SELECT payout_id FROM payout_attempts WHERE provider=$1 AND provider_request_key=$2",
                [provider.name, r.requestKey],
              )
            ).rows[0];
            if (!a)
              await db.transaction((tx) =>
                service.issue(tx, null, "MISSING_INTERNAL", {
                  reference: r.reference,
                }),
              );
          }
        for (const p of (
          await db.query(
            "SELECT id FROM payouts WHERE lifecycle IN ('SUBMITTED','PROCESSING') AND submitted_at<now()-($1*interval '1 second')",
            [c.stale],
          )
        ).rows)
          await service.markStale(p.id);
      }
      await db.query("INSERT INTO worker_heartbeats(worker,state) VALUES('payouts','ok') ON CONFLICT(worker) DO UPDATE SET last_seen_at=now(),state='ok'");
    },
    { connection, prefix: queuePrefix(), concurrency: 4 },
  );
  worker.on("error",()=>console.error(JSON.stringify({event:"payout_worker_connection_error"})));
  worker.on("failed", (job) => {
    if (job)
      void db
        .query(
          "INSERT INTO worker_failures(job_id,job_name,safe_context,failure_code,attempts) VALUES($1,$2,$3,'PAYOUT_JOB_FAILED',$4) ON CONFLICT(job_id) DO UPDATE SET attempts=excluded.attempts",
          [
            "payout:" + job.id,
            job.name,
            JSON.stringify({ payoutId: job.data?.payoutId ?? null }),
            job.attemptsMade,
          ],
        )
        .catch(() =>
          console.error(
            JSON.stringify({ event: "payout_failure_record_error" }),
          ),
        );
  });
  await queue.upsertJobScheduler(
    "dispatch",
    { every: c.poll },
    { name: "dispatch", data: {} },
  );
  await queue.upsertJobScheduler(
    "reconcile",
    { every: 300000 },
    { name: "reconcile", data: {} },
  );
  registerWorkerShutdown(async()=>{await worker.close();await queue.close();await app.close();});
}
void main().catch(() => {
  console.error(JSON.stringify({ event: "payout_worker_failed" }));
  process.exitCode = 1;
});

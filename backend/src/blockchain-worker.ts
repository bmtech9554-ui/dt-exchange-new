import {queuePrefix} from './common/queue-config';
import {registerWorkerShutdown} from './common/worker-shutdown';
import {redisConnection} from './common/queue-config';
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Queue, Worker } from "bullmq";
import { AppModule } from "./app.module";
import { ScanService } from "./modules/blockchain/scan.service";
import { DepositsService } from "./modules/deposits/deposits.service";
import { DatabaseService } from "./common/database.service";
import { requireTransactions } from "./modules/blockchain/chain.config";
async function main() {
  if (process.env.MANUAL_DEPOSIT_REVIEW === "true") throw new Error("AUTOMATIC_WORKER_DISABLED_IN_MANUAL_MODE");
  const config=requireTransactions(),connection=redisConnection();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  const scans = app.get(ScanService),
    deposits = app.get(DepositsService),
    db = app.get(DatabaseService);
  const queue = new Queue("dt-blockchain", {
    connection,
    prefix: queuePrefix(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 3600, count: 5000 },
      removeOnFail: false,
    },
  });
  const worker = new Worker(
    "dt-blockchain",
    async (job) => {
      if (job.name === "scan-dispatch") {
        for (const a of await scans.addresses()) {
          await queue.add(
            "address-scan",
            { id: a.id },
            {
              jobId: `address-${a.id}-${Math.floor(Date.now() / config.scanInterval)}`,
            },
          );
          await db.query(
            "UPDATE chain_scan_cursors SET last_scheduled_at=now() WHERE wallet_address_id=$1",
            [a.id],
          );
        }
      } else if (job.name === "confirmation-dispatch") {
        for (const b of await scans.pending())
          await queue.add(
            "deposit-match",
            { hash: b.tx_hash },
            {
              jobId: `tx-${b.tx_hash}-${Math.floor(Date.now() / config.scanInterval)}`,
            },
          );
      } else if (job.name === "address-scan") await scans.scan(job.data.id);
      else if (job.name === "deposit-match")
        await deposits.inspect(job.data.hash);
      else if (job.name === "order-expiry") await deposits.expire();
      else if (job.name === "stale-review") await deposits.stale();
      else throw new Error("UNKNOWN_JOB");
      console.log(
        JSON.stringify({
          event: "blockchain_job_completed",
          job: job.name,
          id: job.id,
        }),
      );
      await db.query("INSERT INTO worker_heartbeats(worker,state) VALUES('blockchain','ok') ON CONFLICT(worker) DO UPDATE SET last_seen_at=now(),state='ok'");
    },
    { connection, prefix: queuePrefix(), concurrency: 4 },
  );
  worker.on("failed", (job) => {
    console.error(
      JSON.stringify({
        event: "blockchain_job_failed",
        job: job?.name,
        id: job?.id,
        attempts: job?.attemptsMade,
      }),
    );
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1))
      void db
        .query(
          "INSERT INTO worker_failures(job_id,job_name,failure_code,attempts) VALUES($1,$2,'BLOCKCHAIN_JOB_FAILED',$3) ON CONFLICT(job_id) DO UPDATE SET attempts=excluded.attempts",
          [job.id, job.name, job.attemptsMade],
        )
        .catch(() =>
          console.error(JSON.stringify({ event: "dead_letter_record_failed" })),
        );
  });
  worker.on("error", () =>
    console.error(
      JSON.stringify({ event: "blockchain_worker_connection_error" }),
    ),
  );
  for (const name of [
    "scan-dispatch",
    "confirmation-dispatch",
    "order-expiry",
    "stale-review",
  ])
    await queue.upsertJobScheduler(
      name,
      { every: name === "stale-review" ? 60000 : config.scanInterval },
      {
        name,
        data: {},
        opts: { attempts: 5, backoff: { type: "exponential", delay: 2000 } },
      },
    );
  const close = async () => {
    await worker.close();
    await queue.close();
    await app.close();
  };
  registerWorkerShutdown(close);
}
main().catch(() => {
  console.error(JSON.stringify({ event: "blockchain_worker_start_failed" }));
  process.exitCode = 1;
});

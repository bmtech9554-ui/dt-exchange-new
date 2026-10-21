# Disaster recovery acceptance

DT Exchange RC1 · 1.0.0-rc.1 · Phase 8

Infrastructure recovery: **NOT_VALIDATED**. Local financial replay tests pass; they do not prove process-crash or live distributed recovery.

| Failure | Controlled staging drill | Acceptance condition |
|---|---|---|
| API crash | Stop API; preserve DB; restart same release | Sessions/retries safe, readiness recovers, no duplicate order |
| Worker crash | Stop worker after claim; restart; inspect durable state | No duplicate credit/payout/journal; unknown payout stays under review |
| Redis interruption | Isolate Redis briefly, restore auth/TLS connection | Workers reconnect; queued work recovered from PostgreSQL |
| PostgreSQL restart | Stop writes, restart test service, re-run reads/transactions | No partial journal or consumed quote without order |
| TRON outage | Controlled timeout/429 adapter fixture | Scanner lag alerts; no unconfirmed credit |
| Payout outage | Sandbox timeout and delayed callback | Stable request key, lookup before retry, no second transfer |
| Webhook outage | Delay signed callback; enable polling | Final state and UTR reconcile exactly once |

Runnable isolated infrastructure tests:

```sh
npm run build --workspace @dt/backend
node --test backend/test/phase6.test.mjs backend/test/phase7.test.mjs backend/test/phase8-e2e.test.mjs
node --test backend/test/redis-integration.mjs backend/test/phase8-redis-recovery.mjs
```

Inject PHASE6_POSTGRES_URL pointing only to a dedicated `dt_phase6_test` or `dt_phase6_test_<suffix>` database; the harness creates/removes its own random schema. Inject PHASE6_REDIS_URL to a dedicated test DB 1–15. Redis scripts use unique queues and never flush shared Redis. Without the URL they explicitly skip. The new recovery case closes a worker, queues a synthetic job twice with the same ID and restarts processing; it is graceful-restart evidence, not a hard-kill financial transfer test. Combine real financial SQL tests and controlled kill/fault drills before live acceptance.

Attach evidence: outage/recovery times, job IDs, attempt counts, journal counts before/after, provider request keys (redacted), reconciliation results and operator approval. No production outage or load test is authorized by this document.

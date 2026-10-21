# Live infrastructure validation

Status: **NOT_VALIDATED** in this workspace. No PostgreSQL server, Redis server, Docker binary or configured test-service URLs are available. PostgreSQL-compatible SQL tests use PGlite; that is real PostgreSQL SQL semantics in WASM, not proof of multi-process server locking, failover or Redis recovery.

The existing opt-in harness is retained. It accepts only a dedicated database named `dt_phase6_test` or `dt_phase6_test_<suffix>`, creates a unique test schema, and drops only that schema afterward. Redis validation requires a dedicated numbered database ≥1 and uses a unique disposable queue. Never supply a production URL.

On isolated staging infrastructure:

```sh
npm run build --workspace @dt/backend
# Inject PHASE6_POSTGRES_URL and PHASE6_REDIS_URL securely for disposable services.
node --test backend/test/phase6.test.mjs backend/test/phase7.test.mjs backend/test/redis-integration.mjs
```

Phase 6 tests exercise eight concurrent quote/order requests, repeated deposit processing, payout creation and referral reward requests. Phase 7 adds concurrent configuration version checks and verifies emergency gates do not interrupt settlement. Redis tests exercise retry/backoff, duplicate job identity and graceful close. The CI service-container job is prepared to run them against PostgreSQL 16 and Redis 7, but the remote CI job has not been executed here.

For actual recovery acceptance, kill/restart isolated workers and Redis under controlled load, record stalled/recovered jobs and prove no extra provider submissions or ledger events. Observe database lock waits/deadlocks and transaction boundaries with separate connections. Do not treat PGlite Promise.all tests as distributed-concurrency proof.

Docker/Nginx/Prometheus runtime validation, TLS/ACL connectivity, physical backup/PITR restore, external alert delivery and browser interactions remain NOT_VALIDATED. Exact tool absence is recorded in `validation/infrastructure-availability.json`.

# Redis validation

DT Exchange · Final Production Setup · based on RC1 1.0.0-rc.1

Status: **NEEDS_INFRASTRUCTURE / NOT_VALIDATED**. No Redis credentials/server are supplied. Both opt-in Redis tests skip locally; a skipped test is not a pass.

Required: endpoint/port, ACL user/password reference, TLS CA/hostname policy, dedicated DB 1–15 and queue prefix. Use authenticated TLS, noeviction and the existing retry/timeout/graceful reconnect configuration. Production must not fall back to in-memory state. Existing API rate limits are authoritative PostgreSQL-backed buckets; do not claim they have become Redis-backed.

```sh
node --test backend/test/redis-integration.mjs backend/test/phase8-redis-recovery.mjs
```

Inject PHASE6_REDIS_URL only for isolated test Redis. Tests use unique queues, bounded retry, stable job IDs and close-worker → queue twice → restart → process once. No shared FLUSHDB and no financial provider request occurs. This is graceful restart testing; abrupt process/network interruption still needs a controlled staging drill.

Validate TLS/authentication, lock renewal, queue retention/recovery, failed-job visibility, retries, namespace isolation and rate-limit behavior in the deployed system. Reconstruct missing work from PostgreSQL, never from assumed balances in Redis. Unknown payout outcomes must be looked up/reconciled, not replayed with a fresh key.

# Disaster recovery and operational runbooks

These procedures are prepared, not rehearsed on live infrastructure. Nominate an incident commander and finance/reconciliation owner before release. Keep timestamps, correlation IDs and safe status evidence in an incident record; exclude user credentials and full bank data.

| Incident | Immediate action | Recovery and exit criteria |
| --- | --- | --- |
| API unavailable | Check readiness, deployment digest, dependency metrics; divert new traffic | Roll back compatible image or restore healthy replica; smoke-test authenticated reads and writes before reopening |
| PostgreSQL unavailable | Stop new financial activity; do not enable in-memory fallback | Restore/fail over primary; verify migration checksums and ledger; reconcile events since last consistent point |
| Redis unavailable | Pause worker scheduling/new activity; preserve SQL state | Restore TLS/ACL/persistence, recreate schedulers, inspect failed/stalled jobs and PostgreSQL pending work |
| Queue backlog/failure | Inspect worker heartbeat, safe failure code, lease and provider status | Repair dependency, restart with bounded concurrency, retry only idempotent jobs with known safe outcome |
| Blockchain provider outage | Disable new address/order issuance; retain pending evidence | Restore provider, resume cursor scans and confirmation checks; validate canonical blocks and duplicate handling |
| Payout provider outage | Disable new payout claims; keep signed webhooks/polling/reconciliation | Inspect every submitted/unknown attempt by stable provider key; retry only definitive eligible failure |
| Deposit stuck | Inspect contract, recipient, raw units, confirmations and deadline | Wrong token/amount/reorg/late payment goes to review; user button is never payment evidence |
| Payout stuck | Inspect attempt timeline, last response, webhook event and provider status | Refresh evidence; unknown outcome remains manual review. Never create a replacement transfer from a timeout alone |
| Ledger mismatch | Emergency pause new financial activity; capture read-only audit report | Reproduce journal/event history. Finance-approved append-only correction or reversal; never edit historic entries |
| Webhook outage | Keep polling active; inspect signature/timestamp failures and proxy limits | Restore endpoint; deduplicate replay by provider event ID, reconcile state and UTR before completion |
| Suspicious activity | Authorized account freeze, revoke sessions, add reason | Review risk evidence with least privilege; release only after documented approval, no casual success override |
| Deployment failure | Activate read-only; stop rollout | Restore previous compatible image; retain additive migration 007 and reconcile in-flight work |
| Backup/storage failure | Alert on missed backup or low disk; preserve WAL | Restore capacity/retention pipeline and perform a verified isolated restore |

## Worker shutdown/restart

Stop new claims using flags first. SIGTERM closes workers/queues/application with a 30-second ceiling; container grace is 45 seconds. A forced exit leaves active jobs recoverable through normal queue/SQL semantics. It does not authorize a new non-idempotent transfer. Restart one worker group at a time, check heartbeats and reconciliation, then raise capacity.

BullMQ delivery is at least once. Persisted idempotency keys, durable event state and provider reconciliation handle retries; no claim of exactly-once network delivery is made. [BullMQ production guidance](https://docs.bullmq.io/guide/going-to-production).

## Database restore decision

Prefer a verified managed failover over restoration when possible. For restore, stop writes, identify the exact recovery point, preserve subsequent provider/webhook evidence and restore into a new isolated cluster. Compare financial history against external records before switching traffic. Never resume automatic payouts just because the database is online.

## Emergency rollback controls

Use Settings → Operational Settings with a permissioned admin, current version and reason. Set `sell=false`, `deposits=false`, `payouts=false` or mode READ_ONLY/MAINTENANCE. Existing incoming deposits and successful/reversed payouts continue accounting. Database restoration cannot reverse an external bank transfer. Keep controls closed until the incident commander and finance owner approve reopening.

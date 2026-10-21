# Disaster recovery status

DT Exchange · Final Production Setup · based on RC1 1.0.0-rc.1

Status: **NEEDS_INFRASTRUCTURE / NOT_VALIDATED**. No actual staging API/worker/database/Redis restart or outage was performed.

| Scenario | Safe drill | Required evidence |
|---|---|---|
| API restart | Restart isolated API while keeping durable DB | Health recovers, no duplicate order/quote consumption |
| Worker restart | Queue synthetic tasks, stop/restart worker | Stable IDs, one financial effect, heartbeat recovers |
| Redis interruption | Isolate connection then restore TLS/auth | No lost durable work, no duplicate journals/payouts |
| PostgreSQL restart | Pause writes and restart staging DB | Transactions roll back safely, pool reconnects, ledger balances |
| Blockchain outage | Controlled provider timeout/429 | Scanner lag alert; no premature deposit credit |
| Payout outage | Sandbox timeout/late callback | Same request key lookup; unknown outcome under review |

Existing local replay/failure tests cover domain invariants; the opt-in Redis harness tests a graceful restart when infrastructure is provided. Neither proves abrupt distributed crash recovery here. Record before/after journal and payout counts, provider request keys safely redacted, job attempts, outage/recovery times and reconciliation. No production fault injection or financial transfer is authorized.

# First 24 hours monitoring

DT Exchange RC1 · 1.0.0-rc.1 · Phase 8

No production monitoring was connected. The following is an operator plan, not measured uptime.

| Severity | Trigger | Initial response |
|---|---|---|
| P1 | Ledger imbalance, duplicate payout risk, database unavailable | Page financial lead/DBA/incident commander; pause new financial writes; preserve evidence and reconcile |
| P2 | Payout provider unavailable, blockchain scan stalled, sustained queue backlog | Page provider/worker owner; inspect last successful scan/job; preserve unknown outcomes |
| P3 | Notification delivery outage, elevated support backlog | Notify engagement/support owner; bounded retry after provider recovery |
| P4 | Noncritical UI or reporting issue without financial impact | Track ticket, assess next release; do not alter ledger to hide symptoms |

At launch and every 15 minutes for the first two hours: inspect registration/auth failures, quote errors, scanner lag, unmatched/late deposits, pending INR liabilities, payout duration/failures, reconciliation issues, webhook rejects and failed jobs. Hourly through hour 24: review aggregate counts, queue depth, provider balance/health, support tickets and alert delivery. Assign overnight ownership and escalation contacts before launch.

Use existing provider-neutral metrics exporter and docker/monitoring rules. Bind metrics privately. Record request/order/payout/job IDs only where needed; no passwords, OTPs, tokens, full bank fields or KYC data in alerts. Redact evidence before sharing. Alert thresholds must be calibrated from staging load and provider service windows, not invented as guarantees.

For a stuck deposit: inspect configured network/contract/recipient, canonical transaction and confirmations; never accept the user's button as payment proof. For stuck payout: look up the same provider request key, verify signed callback/polling state and reconcile UTR/amount. Unknown results require review, not blind retry. For ledger mismatch: stop new activity, take a consistent read-only report and investigate immutable source events. For notification failure: retry only eligible delivery records; never resend unbounded audiences.

At 24 hours, financial operations signs off reconciliation, incident inventory and outstanding liabilities; release lead records whether rollout remains enabled or requires rollback. No automatic GO follows elapsed time.

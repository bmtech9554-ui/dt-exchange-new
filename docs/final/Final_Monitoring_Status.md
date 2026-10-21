# Monitoring and alerting validation

DT Exchange · Final Production Setup · based on RC1 1.0.0-rc.1

Status: **NEEDS_INFRASTRUCTURE / NOT_VALIDATED**. Existing metrics exporter and docker/monitoring rules are prepared; no collector, dashboard or alert delivery endpoint is connected. No external alert was sent.

Validate API liveness/readiness/latency/errors, DB connections, Redis connectivity, queue depth/failed jobs, worker heartbeats, scanner lag, payout processing age, webhook failures, ledger/reconciliation mismatches and provider health. Use private bindings, authenticated collection and redacted identifiers. Provider health configuration must not imply live connectivity.

| Priority | Trigger | Owner / response |
|---|---|---|
| P1 | Ledger mismatch, duplicate payout risk, database outage | Incident commander + financial lead/DBA; pause new activity, preserve evidence, reconcile |
| P2 | Payout provider outage, stalled blockchain scan, large backlog | Provider/worker operator; inspect stable requests and lag, no blind financial replay |
| P3 | Notification provider outage | Engagement/support owner; bounded eligible retry |

Supply collector/dashboard choice, alert receiver, retention policy, named on-call contacts and an approved nonfinancial test-alert route. Trigger one controlled signal per priority in staging, confirm receipt/acknowledgment and recovery clearing, and record timestamps. Tune thresholds from measured staging behavior and provider service windows; no invented latency or availability guarantee.

# First 24 hours operations

DT Exchange · Final Production Setup · based on RC1 1.0.0-rc.1

Plan only; no production service is running under this execution.

Every 15 minutes for the first two hours, then hourly through hour 24: review registration/OTP failures, rate/quote errors, sell creation failures, deposit detection and confirmation lag, ledger integrity, payout age/failure rates, reconciliation issues, webhook rejects, queue backlog/failed jobs and support volume. Record actual observed counts/latency; do not invent performance targets from local fixtures.

P1: ledger mismatch, duplicate payout risk, database outage — page incident commander/financial lead/DBA, pause new activity and preserve evidence. P2: payout provider outage, scanner stall or large backlog — provider/worker owner investigates stable requests and recovery. P3: delivery provider outage — engagement/support owner performs bounded eligible retries.

Keep request/order/payout/job identifiers where useful, with restricted access; never include full bank accounts, OTPs, tokens, secrets or KYC payloads in alerts. Validate alert routing before launch, including off-hours ownership. No external message or alert was sent as part of this task.

For stuck deposits inspect authoritative chain/network/contract/recipient/confirmations. For stuck payouts query the original provider key and reconcile reference/UTR; never blindly retry. At 24 hours, financial owner signs off liabilities/reconciliation and incident inventory. Elapsed time is not automatic acceptance.

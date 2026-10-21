# Phase 5 payout architecture

## Boundaries

NestJS owns money and state. Flutter and Next.js display server results. `PayoutProvider` isolates vendor behavior. The current mock stores its records in PostgreSQL, survives process restarts and never automatically succeeds. Real adapters must implement their vendor's request/status/signature contracts, map statuses, validate responses, and register in `PayoutsModule`. The existing business service does not need vendor-specific status logic.

`payouts` remains one aggregate per order. `payout_attempts` preserves every request key, provider reference and result. Immutable bank data is AES-GCM encrypted with record-specific associated data. Public views expose only masked bank data; provider error codes/reasons are restricted to admin views.

## Lifecycle and submission

| Event | Payout state | Order state |
|---|---|---|
| Eligible confirmed order | CREATED → QUEUED | READY_FOR_PAYOUT |
| Durable submission claim | SUBMITTED | PAYOUT_PROCESSING |
| Provider processing | PROCESSING | PAYOUT_PROCESSING |
| Confirmed success + ledger settlement | SUCCESS | COMPLETED |
| Definitive failure | FAILED | FAILED |
| Explicit safe retry | New QUEUED attempt | READY_FOR_PAYOUT |
| Unknown submission outcome | MANUAL_REVIEW | PAYOUT_PROCESSING; continues status polling |
| Confirmed reversal | REVERSED | MANUAL_REVIEW |
| Explicit admin review | MANUAL_REVIEW | MANUAL_REVIEW |

Legacy payout enums are retained for compatibility; the additive `lifecycle` column supplies the complete public state model. SQL triggers enforce order/payout transition rules and immutable attempt identities. A completed order requires a success payout, UTR and settlement journal. No client or admin endpoint directly marks success.

A transaction locks the user, order and payout rows, creates a unique attempt and outbox event, then commits. A later worker claims the attempt before invoking the provider outside the database transaction. A second worker cannot claim the same queued attempt. A crash after the claim is an uncertain outcome: workers poll, rather than issuing a new transfer. The provider request key is `order-id:payout:attempt-number`. Permanent database constraints, not expiring API cache records, enforce financial idempotency.

## Eligibility and risk

Creation and submission validate active/verified account, owned verified non-disabled bank, configured bank cooldown, open risk flags, repeated recent failures, an unreversed sell journal and credited canonical deposit evidence meeting the order/transaction confirmation threshold. Wallet-funded sells use the existing Phase 4 reservation ledger and confirmed user deposit evidence.

Amounts are locked quote paise and never recalculated by clients. Token arithmetic remains exact. Minimum/maximum provider and platform limits are applied before submission. A locked `payout_platform_daily` row serializes UTC daily reservations. Failed requests retain that budget reservation conservatively; automatic budget release is deliberately absent.

Risk checks block/review, without exposing internal rule details to users. A newly ineligible queue item enters manual review. A high-risk reconciliation flag blocks later financial activity. Resolving an issue record does not automatically release a risk hold or send money.

## Accounting

Phase 4 created the user's pending INR liability, net of fees. Success posts one balanced journal keyed `payout:payout-id`:

| Account | Debit | Credit |
|---|---:|---:|
| User INR pending payout liability | Locked net INR | — |
| Platform INR provider clearing/payable liability | — | Locked net INR |

This transfers the obligation into the provider clearing account; it does not invent a prefunded cash asset or overwrite balances. External provider funding/cash statements must be reconciled operationally before release. User pending balance derives from ledger entries.

A provider reversal posts the exact opposite journal linked with `reversal_of` and key `reverse:payout:payout-id`. Original entries remain immutable. Failed attempts create no settlement journal. UTR, provider reference, status, settlement, order transition and in-app notifications commit atomically.

A chain reorg before payout retains Phase 4 unwind behavior. Once a payout is submitted/unknown/successful, the system preserves financial history, flags chain exposure and moves affected orders into review. It does not pretend a bank transfer was reversed merely because the crypto deposit disappeared. Any loss/receivable adjustment requires a reviewed accounting resolution.

## Retry safety

- BullMQ uses bounded attempts with exponential backoff; database state remains authoritative.
- Automatic **new attempt** retry is limited to an adapter's explicit `PayoutTransientError(true)` assertion that the provider did not accept the request. The original attempt becomes a definitive transient failure, and a later worker may create a new numbered attempt within configured limits.
- Timeout, lost response, uncertain acceptance and ambiguous provider failure enter review and are polled. They do not authorize another transfer.
- Treasury can retry a definitively failed attempt with permission and reason, subject to fresh eligibility and retry limits.
- A signed success received during chain/admin review records the actual settlement but does not silently complete an order already under review.

## Webhooks

`POST /api/v1/webhooks/payout/mock` verifies HMAC-SHA256 over `timestamp + '.' + rawBody` using `PAYOUT_WEBHOOK_SECRET`. It uses constant-time comparison, a five-minute tolerance, a 64 KiB limit and permanent `(provider,event_id)` uniqueness. Same ID/body is a no-op; same ID/different hash is rejected. Only event ID, type, digest, timestamps and processing result are stored. Raw bank payloads are not retained.

The mock signature contract is specific to the mock adapter. A real vendor adapter must verify its own documented signature, raw-body and timestamp scheme. Polling uses the same normalized result application path as webhooks.

## Workers and operations

`dt-payouts` schedules dispatch/polling at `PAYOUT_STATUS_POLL_INTERVAL` (default 30 seconds) and reconciliation/stale review every five minutes. Tasks include submission, safe retry discovery, outbox recovery, status refresh, provider inventory comparison where supported, balance monitoring where supported and stale review. Job failures are retained in BullMQ and `worker_failures`; logs contain safe event identifiers rather than provider response bodies.

Redis acknowledgements are not financial commits. A dispatcher may repeat a job; queued-record recovery covers a lost acknowledged outbox job. Database claims, immutable attempts and journal/event uniqueness protect repeated execution. Separate-process PostgreSQL/Redis concurrency and crash tests remain required deployment validation; PGlite tests do not establish those guarantees under a real cluster.

Only one provider adapter is configured per deployment in this phase. Drain/reconcile its outstanding attempts before switching adapters. Multi-provider routing and provider cash funding imports are not implemented implicitly.

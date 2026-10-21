# DT Exchange — Phase 5 implementation

Phase 5 extends the approved Phase 4 codebase. It adds the INR payout lifecycle using a durable, explicitly labelled sandbox provider. No real INR transfer was executed. Phase 6 has not started.

## Implemented

- Provider port and adapter registration boundary; IMPS, NEFT and RTGS capabilities; optional beneficiary checks, balance monitoring, cancellation and provider inventory interfaces. Only `MockPayoutProvider` is registered. An unregistered provider or enabled production sandbox fails closed.
- One payout aggregate per sell order, with encrypted immutable bank snapshot and separate numbered attempts. Existing payout, attempt, provider-event, notification and outbox tables are reused.
- Eligibility at creation and immediately before submission: active verified account, verified owned bank, bank cooldown, funding journal, confirmed chain deposit, open risk flags, repeated failures, exact locked amount, provider/internal limits and serialized UTC daily platform budget.
- Durable outbox and BullMQ worker for discovery, submission, fallback polling, conservative retry, reconciliation and stale review. Queued records are redispatched if Redis loses an acknowledged job.
- HMAC-authenticated raw-body webhooks, five-minute timestamp tolerance, permanent event deduplication and payload digest conflict detection. Payloads, secrets and full account numbers are not logged.
- Atomic provider-confirmed settlement, UTR storage, order completion, status history, notifications and audit records. Reversals append reversing journals and move orders into review.
- Reconciliation issues for missing records, state/amount/reference/UTR mismatch, ledger/order inconsistency and chain reorg exposure. Ambiguous discrepancies are not silently repaired.
- Flutter processing/completion/detail/history/notifications consume API state. The existing success animation, cards, navigation and typography are retained. Ready orders poll only when payout execution is enabled.
- Next.js payout queue, processing, success, failure, manual-review, reversal and reconciliation views. Retry, review, refresh and notes require backend permissions and reasons. No manual-success endpoint exists.

## Design preservation

21 protected files match the baseline: original migrations 001–004, canonical/mobile/admin logo vectors, design tokens, core design/widgets, four-tab navigation and Profile. The presentation kit's phase-status sentence was updated; it was not restyled. Existing Home and Sell copy now describes provider-confirmed updates. Profile remains User Details, Bank Accounts, Referral Program, Settings and Logout.

## Run locally

Use the existing setup and development keys from Phase 3–4. Never use development providers in production.

```sh
npm ci
npm run db:migrate
npm run db:seed
node --env-file-if-exists=.env backend/scripts/seed-phase3.mjs
node --env-file-if-exists=.env backend/scripts/seed-phase4.mjs
node --env-file-if-exists=.env backend/scripts/seed-phase5.mjs
npm run build
npm run start --workspace @dt/backend
npm run worker --workspace @dt/backend
npm run worker:payouts --workspace @dt/backend
npm run dev:admin
```

The worker processes require PostgreSQL and Redis. Configure `TRANSACTIONS_ENABLED=true`, `PAYOUTS_ENABLED=true`, `PAYOUT_PROVIDER=mock` and the Phase 4 mock chain settings for an isolated development environment. Create a random webhook secret of at least 32 characters. The default bank cooldown is 86400 seconds; an explicit development-only setting of `PAYOUT_BANK_COOLDOWN_SECONDS=0` allows immediate sandbox testing. Payout minimum, maximum and daily values are **integer paise**, not rupees.

A confirmed order is discovered by the worker, queued and submitted. The sandbox remains PROCESSING until an operator supplies a sandbox outcome. The optional simulator does not contact any bank:

```sh
node --env-file-if-exists=.env backend/scripts/sandbox-payout.mjs \
  '<provider-request-key>' SUCCESS SANDBOX-UTR-EXAMPLE --sandbox-confirm
```

Use an actual persisted sandbox attempt key. Set `SANDBOX_WEBHOOK_URL` to the local webhook endpoint to exercise signed delivery, or let polling discover the simulator's persisted outcome. FAILED and REVERSED are also supported. The simulator requires explicit mock, non-production mode. Its UTR must start with `SANDBOX-`.

## Admin access

The existing admin login/session/TOTP system is reused. Run the Phase 5 permission seed; it grants read/retry/refresh/review to the existing **treasury** role, without creating credentials or granting the role to any user. Assign that role through your controlled administrative provisioning process. The existing operations-only provisioner intentionally does not grant treasury permissions. Configure the Next.js server's `DT_BACKEND_URL`; production requires HTTPS. Cookies remain HttpOnly, SameSite=Strict with same-origin POST protection.

## Evidence and limits

See `Phase5_Test_Results.md`. Mobile PNGs are actual Flutter widget renders with labelled sandbox API fixtures. The admin HTML preview renders the actual React payout component with labelled fixtures and disabled controls; it is not a browser screenshot or proof of browser runtime validation.

Native Android/iOS validation, live PostgreSQL concurrency, real Redis worker execution, browser interaction and any selected bank provider's contract/sandbox acceptance remain deployment gates. The provider port is ready for a reviewed adapter, but this delivery does not contain an integration for an unnamed banking vendor or production credentials.

Stop after Phase 5. Await **Continue Phase 6**.

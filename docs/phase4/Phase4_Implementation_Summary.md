# DT Exchange — Phase 4 implementation

Phase 4 extends the approved Phase 3 project. It does not rebuild the application and does not implement INR payout execution. Confirmed, accepted USDT reaches `READY_FOR_PAYOUT`; no payout, UTR or completed sale is fabricated.

## Delivered

- Quote-to-order conversion with ownership, expiry, single-use, bank, verification, risk and limit checks. Accepted quote amounts, rate and fees remain immutable. Request replay uses the existing encrypted idempotency store; the unique quote/order relationship remains permanent.
- Existing wallet/address tables support a permanent wallet deposit address and a unique, never-reused address for each on-chain order. Wallet-funded sales use ledger availability. Custody allocation is a provider interface, not local private-key generation.
- TRON provider port, isolated mock provider, and a read-only HTTP RPC/indexer adapter. The HTTP adapter is implemented and tested with response fixtures; it has not been validated against a live provider or real funds.
- Token, network, recipient, execution, amount and confirmation validation. Ambiguous, underpaid, overpaid, late, failed and reorged transfers enter review. Financial idempotency is enforced by PostgreSQL constraints, locks and permanent journal keys.
- Double-entry deposit, reservation, conversion, fee and reversal journals. Wallet balances and pending INR liability are derived from ledger entries.
- Durable scanning cursors and BullMQ scan, matching/confirmation, expiry and stale-review jobs, with backoff, retained failures and database failure records.
- Flutter Confirm/Send/Track, Wallet, History, transaction details and Home balance/recent records connected to APIs. Tracking polls every eight seconds, pauses in the background, disposes timers, and stops automatically at the Phase 4 terminal states.
- Next.js deposit/order monitoring, order detail and manual-review queue. Separate expiring admin sessions, live role permissions, production TOTP requirement, HttpOnly same-site cookies and reasoned review acknowledgements. No financial-value editing or manual-credit endpoint.

## Preservation

The canonical DT SVGs, mobile logo widget, design tokens, shared core components, four-tab navigation and Profile source are checked against the Phase 3 hashes in `baseline.json`. They remain unchanged. Phase 1–3 migrations are unchanged. API-backed presentation reuses the established cards, buttons, QR/copy components and animation language; phase notices now accurately state that INR payouts remain pending.

`004_transaction_foundation.sql` adds order funding-address/confirmation snapshots, immutable status history, scan cursors, worker failures, risk deduplication, administrative TOTP replay protection and indexes. Existing business tables and financial snapshot relationships are reused.

## Local development

Requires Node 24, PostgreSQL 16+, Redis, and Flutter. Keep the existing `.env` and its encryption keys; never replace keys on an existing database.

```sh
npm ci
# Only for a NEW checkout without .env:
node scripts/setup-dev-env.mjs
# Merge the new Phase 4 placeholders into an existing .env instead.
docker compose --env-file .env -f docker/compose.dev.yml up -d
npm run db:migrate
npm run db:seed
node --env-file=.env backend/scripts/seed-phase3.mjs
node --env-file=.env backend/scripts/seed-phase4.mjs
npm run build
npm run start --workspace @dt/backend
# Separate terminal:
npm run worker --workspace @dt/backend
```

Before starting the worker, explicitly set `TRANSACTIONS_ENABLED=true`, `TRON_PROVIDER=mock`, `TRON_NETWORK=tron-mock`, and `TRON_USDT_CONTRACT=DT-MOCK-USDT-CONTRACT` for development. The Phase 4 seed provisions that isolated network only. Set `MOCK_VERIFICATION_DECISION=verified` only in a development environment when testing the verified-account flow. Existing OTP development-provider controls remain in force.

`TRON_MOCK_FIXTURE_FILE` can point to local JSON containing `head` (decimal string) and `transactions` conforming to `ChainTransaction`. Populate a returned mock address, fresh timestamp and exact raw token amount. Increasing the mock head exercises confirmation progression. These `DT-MOCK-TRON-…` addresses are deliberately **not payable TRON addresses**. Never send funds to them.

```sh
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://YOUR_DEVELOPMENT_HOST:4000/api/v1
```

Release mobile/web builds require an HTTPS API URL. Android emulator loopback normally differs from the host; configure the address for your runtime. `DT_PREVIEW=true` remains the separate, explicitly labelled historical UI simulation mode; normal mode uses the APIs.

For monitoring, set server-side `DT_BACKEND_URL`, provision an operations user with `backend/scripts/provision-admin.mjs` using securely supplied `ADMIN_EMAIL`, `ADMIN_PASSWORD` and, for production, `ADMIN_TOTP_SECRET`. Run the script after backend compilation and reference seeding. Open `/orders` or `/deposits` in the existing admin. No default admin credentials are shipped.

## Validation and remaining external work

See `Phase4_Test_Results.md` for exact results. Flutter widget runtime and web compilation are available. Native Android/iOS execution, a real PostgreSQL concurrency run, Redis/BullMQ integration, and real RPC/indexer/custody acceptance remain environment/provider validation items. Production OTP/verification/rate adapters inherited from Phase 3 are also deployment prerequisites. This package is a tested transaction foundation, not a deployed live exchange or a claim of independent security certification.

Phase 5 has not started. The next authorized work must begin only after **“Continue Phase 5.”**

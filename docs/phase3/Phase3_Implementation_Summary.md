# DT Exchange — Phase 3 implementation

Phase 3 extends the approved Phase 1 + Phase 2 repository. It is a tested application foundation, not authorization to operate a live exchange. Phase 4 has not started.

## Delivered

- NestJS authentication: registration, email/mobile password login, email/SMS OTP provider port, contact verification, recovery/reset, password change, RS256 access JWTs, hashed rotating refresh tokens, device-family sessions and logout controls.
- OTP expiry, resend cooldown, committed attempt limits, destination/IP quotas, encrypted developer inbox, audit events and single-use reset grants. Development OTP visibility is explicit configuration and forbidden in production.
- Real encrypted user profiles with account and verification state. The Profile retains only User Details, Bank Accounts, Referral Program, Settings and Logout.
- Required account verification provider architecture for identity, PAN, documents, selfie/face, bank and risk. Onboarding submits provider workflows; clients cannot self-approve. Mock results are explicitly sandbox-only. No production identity check is fabricated.
- Owned bank CRUD, masking, encrypted account/holder fields, deduplication, verified-only default selection, safe soft disable and a bank-verification provider port.
- Server rate engine with manual/market/plus-margin/minus-margin modes, spread, freshness checks, policy/fee versioning and replaceable market provider.
- Exact integer fee/quote calculation, per-user idempotency, immutable financial snapshots, quote lifecycle, expiry/cancellation and database-enforced one-time order acceptance. No public sell execution endpoint.
- Reusable limits service: minimum/maximum, daily/monthly India-time periods, account overrides, verification/risk gates, active-quote capacity and user-row locking.
- Flutter Dio connection, secure refresh-token storage, single-flight refresh, login/register/OTP/recovery, real Profile/banks/rates, debounced server quote previews, password change and device-session controls. Loading, error, skeleton, count-up, reveal and navigation animations remain.

## Design preservation

Canonical color tokens, foundational Flutter design/widgets, four-tab navigation and migration 001 are byte-for-byte preserved; see `validation/preservation.json`. The final explicit Phase 3 logo approval supersedes the old Phase 1 monogram. Its mint/teal D and blue T have been implemented as a clean vector from the supplied raster reference, copied identically to mobile/admin and rasterized for native/web icons. No symbols or new concept were added. The original editable logo vector was not supplied, so pixel-identical reproduction is not claimed.

The visual benchmark is retained at `docs/brand/Approved_Reference.jpeg`; see `docs/brand/FINAL_LOGO.md`. Existing Phase 2 layouts are retained. Profile has no Crypto Card, KYC/PAN/identity/selfie menu or separate security menu. Home/Wallet/History/Profile remain the only bottom tabs.

## Database and architecture

Existing NestJS modules, PostgreSQL tables, Flutter Riverpod/Dio/GoRouter/Secure Storage and Next.js admin shell remain. No replacement app or duplicate users/banks/rates/auth tables were created.

- `002_verification_states.sql`: NOT_STARTED/UNDER_REVIEW enum additions, committed independently before use.
- `003_application_foundation.sql`: minimal verification/bank metadata, OTP delivery state, indexes, rate spread, shared rate-limit buckets, account limit overrides, and a separate quote lifecycle table. Original quote rows, audit and ledger history remain append-only.
- Quote acceptance trigger now consumes its lifecycle atomically and checks user/bank eligibility. Phase 4 must still implement full order eligibility/limit rechecks, funding and ledger execution.
- PostgreSQL backs distributed request quotas and idempotency; Redis/BullMQ infrastructure remains reserved for later workers.
- `OtpProvider`, `VerificationProvider`, `RateProvider`, `SecondFactorVerifier` and device-side `DeviceAuthenticator` are integration boundaries. No 2FA/biometric success is claimed; those toggles remain disabled in connected mode.

## Run locally

Use Node 24, PostgreSQL 16+, and the existing Flutter toolchain.

```sh
npm ci
node scripts/setup-dev-env.mjs
docker compose --env-file .env -f docker/compose.dev.yml up -d
npm run db:migrate
npm run db:seed
node --env-file=.env backend/scripts/seed-phase3.mjs
npm run dev:api
```

The generator refuses to overwrite `.env` and creates random Compose credentials, separate 256-bit keys and an RSA key pair. Keep these local; they are excluded from the archive. If continuing with an existing `.env`, add the new keys securely rather than overwriting existing encryption material. The compatibility `backend/scripts/dev-config.mjs` invokes the existing generator.

For local sandbox review only, set `DEV_OTP_EXPOSE=true`; set `MOCK_VERIFICATION_DECISION=verified` only when deliberately testing successful sandbox activation/bank checks. Default review status is UNDER_REVIEW. No actual SMS/email, identity match or penny drop occurs. Credentials and real vendor adapters are needed before production delivery/verification. Development seed policies must not be used as approved production rates.

```sh
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000/api/v1
```

Android emulator uses `10.0.2.2`; iOS simulator normally uses the host loopback with an appropriate local HTTPS endpoint. Real devices need a reachable trusted HTTPS API. Release builds reject non-HTTPS API URLs. Android release manifest includes Internet permission; only the debug manifest permits local cleartext. Do not expose the development OTP inbox beyond a trusted local environment.

`flutter run -t lib/main_preview.dart` remains the explicitly isolated Phase 2 presentation demo. Connected `main.dart` starts login/session restoration instead of the old non-operational placeholder. It shows zero/unavailable wallet data and no fabricated transaction history; deposit addresses and money-moving routes are disabled. Referral, support, PIN and other later-phase preview pages remain labelled demonstrations, not live services.

## Validation and remaining integration gates

See `Phase3_Test_Results.md` for commands, exact results and limits. API tests use real Nest controllers/guards/services with PGlite PostgreSQL, not a mocked business service. Flutter connection tests use controlled HTTP fixtures, with real backend contracts tested separately. Screenshots are real Flutter engine renders of sandbox fixture responses, not evidence of production provider operation.

Native Android/iPhone signing and device execution require SDKs/hardware absent here. Production PostgreSQL multi-process concurrency, ingress configuration, managed key rotation/backups, provider delivery/callback verification, approved legal copy and native secure-storage/biometric behavior still require deployment integration testing. No external credentials, production systems or real customer data were used.

No TRC20 listener, wallet private keys, real deposits, ledger credits, bank transfers or INR payouts were implemented. Await **Continue Phase 4**.

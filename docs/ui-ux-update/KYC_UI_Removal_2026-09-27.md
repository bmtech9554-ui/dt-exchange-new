# KYC UI removal — 27 September 2026

## Product changes

- Mobile registration/OTP continues directly to Home. Removed the identity activation page and `/activation` route, forced financial-route redirect, Home identity status, Profile identity badge, and identity-onboarding FAQ/copy.
- Profile retains User details, Bank Accounts, Referral Program, Settings and Logout. Home / Wallet / History / Profile tabs, the approved logo, single-coin header, rate card and financial forms are preserved.
- Preview quotes and confirmation no longer depend on the identity boolean. Bank eligibility, amount and balance checks remain. Identity state is not silently changed to approved.
- Admin Verification Reviews sidebar/page and browser API forwarding were removed. Direct `/verification` resolves to not-found. Legacy identity fields are hidden from Users and Dashboard rendering.
- Dashboard uses active users, pending deposits, deposits approved today, manual payouts pending and completed payouts instead of identity counters. Users exposes authorized contact details, account status, bank/deposit/order/payout counts and last login.

## Backend compatibility and safeguards

Existing verification tables, migrations 001–008, provider interfaces, review APIs/permissions and audit history are preserved. The product UI no longer invokes identity review. Bank validation and OTP remain separate.

Manual deposit review/approval and manual payout processing now require an active account and retain risk checks without requiring identity approval. Quotes and order acceptance omit the identity gate only when both existing manual-deposit and manual-payout modes are enabled. Automatic-provider paths retain their identity requirements.

New additive migration `backend/migrations/009_manual_identity_optional.sql` preserves quote freshness/single-use, active-account and verified-bank trigger checks. It permits the identity exception only for wallet-funded orders with a backend-set, transaction-local manual-flow flag. No user becomes KYC verified as a side effect. Manual backend readiness now requires migration 009.

**Connected backend prerequisite:** apply migration 009 using the existing migration runner in the intended authorized environment before using the updated manual flow. This work applied migrations only inside isolated test databases; no VPS, persistent deployment database or production infrastructure was changed.

Manual bank approval, risk flags, frozen/suspended account restrictions, limits, RBAC, immutable quote terms, proof review, payment evidence, permanent idempotency, audit records and balanced ledger posting remain in place. Existing reward/provider eligibility policies outside the current manual deposit/sell/payout flow are preserved.

## Validation

- `flutter clean`, `flutter pub get`: passed.
- `flutter analyze`: no issues.
- `flutter test`: 333 passed.
- Backend compilation and full Node test suite: 171 passed (PGlite and isolated adapters).
- Admin tests: 19 passed, including retired-route 404, sidebar, legacy field hiding and manual operation rendering.
- Next.js production build/type checking: passed locally.
- Full manual lifecycle tested while identity remains REQUIRED: proof -> admin approval -> one balanced credit -> wallet sale -> evidenced manual payout. Frozen/risk-flagged accounts remain blocked; automatic mode remains gated.
- Migration runner applies all nine migrations and replays without changes.
- Physical Android installation, real PostgreSQL concurrency, live providers and production deployment were not performed.

## Changed files

Mobile:
- `mobile/lib/app/router.dart`
- `mobile/lib/features/auth/auth_pages.dart`
- `mobile/lib/features/home/home_page.dart`
- `mobile/lib/features/profile/profile_pages.dart`
- `mobile/lib/features/settings/settings_pages.dart`
- `mobile/lib/features/support/support_pages.dart`
- `mobile/lib/preview/preview_controller.dart`
- `mobile/test/navigation_test.dart`
- `mobile/test/preview_controller_test.dart`
- `mobile/test/responsive_preview_test.dart`
- `mobile/test/no_identity_ui_test.dart`

Admin:
- `admin/src/lib/navigation.ts`
- `admin/src/app/[module]/page.tsx`
- `admin/src/app/api/operations/[...path]/route.ts`
- `admin/src/components/production-operations.tsx`
- `admin/src/components/foundation.tsx`
- `admin/test/operations.test.tsx`
- `admin/test/tsconfig.json`

Backend:
- `backend/src/modules/manual/manual.service.ts`
- `backend/src/modules/orders/limits.service.ts`
- `backend/src/modules/orders/orders.service.ts`
- `backend/src/common/operations.service.ts`
- `backend/src/common/database.service.ts`
- `backend/migrations/009_manual_identity_optional.sql`
- `backend/test/manual.test.mjs`
- `backend/test/phase4.test.mjs`

Also `.gitignore` (local test/tool helpers) and this report.

## APK

`flutter build apk --debug -t lib/main_preview.dart` succeeded after the clean build. Android APK signature verification passed (v2).

Exact output: `C:\Users\Ashik\Downloads\dtexchange update\DT_Exchange_UI_Manual_Deposit_Update\dt-exchange\mobile\build\app\outputs\flutter-apk\app-debug.apk`

Build warnings about future Kotlin Gradle Plugin migration and Java 8 source compatibility are non-blocking with the current toolchain.

# DT Exchange · Phase 7

Production preparation is implemented on the existing Phase 6 source. **This is not approval to launch production.** No real USDT, INR, email, SMS or push delivery was initiated. Phase 8 has not started.

## Implemented

- A shared startup gate covers API and worker application contexts. Mounted secret files are loaded before imports. Production rejects mock names, insecure dependency configuration and unregistered real adapters. There is no environment switch to bypass the missing-adapter gate.
- Additive migration 007 adds operational controls, a ledger integrity view, indexes and least-privilege admin permissions. Migrations 001–006 are unchanged.
- Database-triggered switches govern registrations, address allocation, quotes/orders, payout creation/submission, referral claims/rewards, notification submission and new support tickets. Configuration changes use row locking, a version check and an audit reason.
- Maintenance/read-only pauses new activity while preserving incoming deposit accounting, existing payout callbacks, reversals and reconciliation. A submission claimed before the switch commits may already be in flight; disabling a flag cannot recall money.
- Admin dashboard, accounts, masked banks, verification review notes, ledger balances, versioned rates/fees/limits, audit summaries, operational settings and provider readiness are connected. Existing payout, reconciliation, support, referral, announcement and FAQ workflows remain. Financial values cannot be manually marked successful.
- Strong admin login retains TOTP and 15-minute opaque sessions. Login rechecks locked account/password state. Engagement login now accepts authenticator codes. Sensitive actions require a reason and confirmation.
- API/BFF payload caps, exact secret-safe error mapping, configurable trusted proxy, PostgreSQL pool/transaction timeouts and bounded worker shutdown are prepared.
- Production Dockerfiles, external-service Compose reference, Nginx TLS configuration, Redis template, CI, private metrics exporter, alert rules, encrypted backup/restore scripts, ledger audit and bounded staging load harness are included.
- Android TLS policy, environment-based signing configuration and R8 settings are prepared. iOS ATS remains secure. Mobile maintenance errors use the existing presentation components.

## Design and source preservation

The approved monogram, design tokens, colors, animation components, four destinations and Profile menu remain intact. The only mobile application change is a friendly, sanitized 503 message. Native build configuration changed for release readiness. No financial calculation or ledger-posting template was redesigned.

The admin root now opens Dashboard instead of the historical design gallery. Existing light components and assets are reused. `Phase7_Admin_Preview.html` renders actual components with explicitly labelled synthetic fixtures; it is not a browser screenshot.

## Release gates

Real payout, verification, market, messaging and storage adapters are not registered. Production deliberately cannot start until reviewed adapters replace the mock-only ports. Provider credentials alone are insufficient. Live PostgreSQL/Redis concurrency, Docker/Nginx execution, browser interaction, encrypted restore drills and signed native builds remain external validation gates. See the test and release reports for exact evidence.

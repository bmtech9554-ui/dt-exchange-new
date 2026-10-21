# Staging acceptance evidence

DT Exchange RC1 · 1.0.0-rc.1 · Phase 8

Controlled local API/SQL acceptance: **MOCK**. Deployed staging acceptance: **NOT_VALIDATED**. No staging URL or provider credentials were supplied.

The new RC1 test uses actual Nest controllers, guards, DTO validation and SQL migrations in PGlite. It registers a test account, verifies its OTP, starts and submits all required mock verification records through the API, adds a bank, creates a quote/order, detects a mock TRC20 transfer and confirms it. It submits the sandbox payout, authenticates a signed callback, checks the sandbox reference and completed order, then reads notifications/history/referral/FAQ and creates/views a support ticket. Repeated callback/deposit/payout handling and read-only ledger audit are asserted separately. The five-journal fixture and timing evidence are printed in backend-final.log. This is not a browser-driven or live-provider transaction.

Existing Phase 1–7 tests cover negative authentication/OTP, ownership, quote expiry, transaction limits, contract/recipient/amount mismatch, reversal/failure/retry, referral idempotency and admin permissions. The Phase 7 admin suite tests server rendering and BFF boundaries, not physical browser clicks.

Read-only deployed smoke probe:

```sh
DEPLOYMENT_ENV=staging node scripts/staging-acceptance.mjs
```

Inject STAGING_API_URL as the verified HTTPS API base including /api/v1. It probes liveness/readiness/system/rate routes without creating transfers. Full interactive checklist: register/login/OTP/profile, verification, bank, quote/order/send screen, timeline/history, notifications/referrals/support, admin login/order/reconciliation/provider health. Record response, latency, screenshot and expected masking using synthetic data only.

Admin acceptance inventory: dashboard, users, verification, banks, deposits, orders, payouts, reconciliation, referrals, support, notifications, announcements, FAQ, audit, queues, health, provider status and settings retain their existing implementations. Backend role tests and 12 rendering/BFF checks pass; search/filter/pagination/loading/error interactions across those modules still require deployed browser acceptance. Emergency controls use audited versioned settings and DB gates; local tests verify denied permissions and paused submissions. Provider-disable behavior is achieved by pausing relevant financial operations, not by pretending a generic hot-swappable provider switch exists.

Mobile network tests cover connection and timeout failures without diagnostics. Existing widget tests cover responsive/landscape layouts and lifecycle states. Real-device offline/slow network, TalkBack/VoiceOver, large text, contrast/hit areas, cold-start/Home/history latency and admin dashboard performance remain manual acceptance items. No 60 FPS or cold-start measurement is claimed. Use bounded staging-load.mjs only against approved isolated infrastructure; never stress external financial providers.

# Release certification

DT Exchange RC1 · 1.0.0-rc.1 · Phase 8

**BLOCKED_FOR_PRODUCTION**

This is the factual certification for RC1. Local tests and builds do not replace staging, provider, signing or operational acceptance. No production deployment, bank transfer or blockchain transfer was initiated.

1. Real payout, OTP, verification, market-rate, email, SMS, push and private-storage adapters are not registered/accepted. Production startup deliberately refuses activation.
2. TRON read-only adapter has no real endpoint, contract or custody acceptance evidence. No real funds were moved.
3. Live PostgreSQL concurrency/reconnect and Redis TLS/authentication/worker recovery have not run in this environment.
4. Android SDK and signing keystore are unavailable; no signed AAB/APK was produced.
5. macOS/Xcode, Apple team and signing profiles are unavailable; no IPA was produced.
6. No staging domain/TLS deployment, browser/device acceptance or operational alert delivery has been validated.
7. No live encrypted backup/restore, PITR or infrastructure disaster-recovery drill was performed.
8. Organizational operating permissions, jurisdiction/store eligibility, retention, provider contracts and privacy disclosures require authorized external approval.

Release operator: run `node scripts/release-gate.mjs release/acceptance.json`. Exit 2 means blocked; exit 1 means evidence cannot be read; exit 0 requires all configured acceptance areas to pass. The checked-in evidence is intentionally incomplete. An operator must hash actual evidence, record a reviewer and timestamp, and independently verify those artifacts; this local JSON gate is not a digital signature or an independent audit. Evidence older than seven days or in the future fails. Do not edit status labels merely to obtain GO.

A real adapter requires code review, its own sandbox contract tests, reversal/replay/timeout acceptance and removal of its capability block through reviewed code. There is no environment-variable bypass. Any critical ledger/reconciliation issue or unresolved critical security issue blocks launch. High findings require explicitly approved mitigation; none is assumed here.

Source integrity: verify the outer Phase8_Package_Receipt.json SHA-256 before extraction, then compare PHASE8_SOURCE_MANIFEST.json. The archive hash is external to avoid self-reference. Mobile signing artifacts are not included.

Next action requires the user's instruction: **Continue Final Production Setup**. This document grants no deployment approval.

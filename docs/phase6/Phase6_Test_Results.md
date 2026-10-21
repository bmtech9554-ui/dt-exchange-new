# Phase 6 — Test results

Validation date: 20 September 2026. Node 24.19.0, Flutter 3.47.5, Dart 3.13.4. This report separates executable evidence from unavailable infrastructure.

| Check | Result |
|---|---|
| Backend TypeScript build | Passed |
| Full backend regression suite | **112/112 passed**: 91 prior tests plus 21 Phase 6 tests |
| Migration execution and second-run idempotency | Passed for all six migrations under PGlite |
| Flutter static analysis | **No issues found** |
| Full Flutter regression suite | **254/254 passed**: 230 prior tests plus 24 Phase 6 responsive widget cases |
| Phase 6 actual Flutter captures | Passed, four viewport configurations; six iPhone screen captures |
| Flutter release web build | Passed; compiled JavaScript web target |
| Next.js production build/type check | Passed |
| Design-token consistency | Passed |
| Protected-file SHA-256 comparison | **22/22 unchanged** |
| Source embedded private-key scan | No embedded private-key blocks detected; environment files excluded from archive |
| Real Redis retry/dedupe harness | Explicitly skipped: no PHASE6_REDIS_URL |
| Real PostgreSQL multi-connection harness | Not executed: no live PostgreSQL service/test URL |
| Android APK build | Blocked: Android SDK not installed |
| iOS native build | Unavailable: Linux environment has no macOS/Xcode |
| Browser interaction validation | Unavailable: Chrome executable absent |

## Backend cases

New cases exercise event notification creation/pagination/read/read-all/ownership, required security preferences, encrypted session-bound push tokens, idempotent concurrent fanout/delivery, safe failure/backoff, ticket request/reply idempotency and authorization, private attachment validation, published FAQs, scrypt PIN/lockout, stable referral codes, self-referral rejection, atomic signup claims, qualifying settled sandbox orders, opt-in sandbox reward behavior, eight concurrent reward calls with one balanced journal, duplicate-device review, least-privilege admin roles/internal-note isolation/audit, closure, readiness, retention-protected deletion, concurrent quote/order/deposit/payout operations, bounded announcements and targeted notifications, provider circuit opening and logout revocation.

All Phase 1–5 database/account/OTP/refresh/bank/rate/fee/limits/order/chain/ledger/payout/webhook/reversal/reconciliation regressions passed. No financial formula was changed to satisfy a new test.

## Flutter evidence

New Notifications, Referral, Support, Settings, Notification Preferences and Ticket Detail screens were rendered using actual Flutter widgets and fixture HTTP responses at 390×844, 412×915, 320×700 with 1.3 text scale, and 844×390 landscape. Tests scroll content and check framework exceptions/overflow. Original logo/cards/buttons/reveal/copy/success components remain shared. The PNG preview is composed from actual Flutter captures, not generated artwork.

The admin HTML preview is server-rendered from the actual React components with the original CSS and labelled fixtures; controls are disabled. It is **not** a browser screenshot or proof of browser interaction testing. Next.js compile/type validation passed.

## Exact limitations

PGlite executes PostgreSQL-compatible SQL but serializes in-process transactions. Passing parallel Promise tests does not establish real multi-connection locking, Redis failover or production load capacity. `postgres-harness.mjs` and `redis-integration.mjs` provide opt-in validation against isolated infrastructure; see Production Hardening.

Web compilation succeeded, including existing flutter_secure_storage_web. Its wasm dry-run reports dart:html/dart:js_util compatibility warnings; a wasm target is not claimed. Android build explicitly reports “No Android SDK found.” Flutter doctor also reports absent Chrome/Linux native build tools and a sandbox network-interface error in its proxy check. These do not invalidate the completed widget tests or JavaScript web build.

No production email, SMS, push message, file upload or bank transfer was sent. Vendor adapters/credentials, native push and biometric/TOTP acceptance, legal-policy publication and storage/retention review remain deployment gates. The secret scan is a limited source check, not a formal security audit or proof that every possible credential pattern was detected.

Evidence is in `docs/phase6/validation/`. Phase 7 and production deployment remain unstarted.

# DT Exchange Phase 3 — test results

Validated in the provided Linux cloud environment. These results establish the tested Phase 3 foundation; they do not certify live providers, deployed concurrency or native device behavior.

| Check | Result |
|---|---|
| Backend TypeScript build | Passed |
| Backend and admin TypeScript checks | Passed |
| Backend suite | **41 passed, 0 failed** |
| Original Phase 1 SQL regression tests | **12 passed**, unchanged test assertions |
| Additional Phase 3 API/security/SQL tests | **29 passed** |
| Additive migrations 001 → 002 → 003 | Applied successfully to fresh PGlite PostgreSQL in API suite |
| Flutter static analysis | **No issues found** |
| Complete Flutter suite | **186 passed, 0 failed** |
| Existing Phase 2 coverage | 8 state tests, 8 navigation tests, 144 responsive screen tests |
| Phase 3 Flutter coverage | 2 API/token/controller tests + 24 API presentation tests |
| Flutter web release build, connected main.dart | **Passed**, JavaScript/CanvasKit output |
| Canonical design token drift check | Passed |
| Protected source hashes and identical approved logo SVG copies | Passed |
| Android APK build | Blocked: **No Android SDK found** |
| iOS build/signing/device run | Unavailable: Linux environment, no Xcode/macOS/native device |

## What the backend suite checks

Registration, encrypted contact persistence and scrypt; OTP request/cooldown, invalid attempts, expiry, five-attempt lock and consumption; email/password and verified-mobile/password/OTP login; authenticated additional-contact verification; safe user Profile; provider-backed sandbox activation; encrypted/masked bank creation; duplicate and mismatched idempotency keys; cross-user read/default/delete/quote denial; single default bank; all rate modes; exact percentage/fixed fee rounding; server-owned quote fields; immutable snapshot; quote cancellation/expiry; one-time ACTIVE→USED acceptance; minimum/maximum/account overrides/daily/monthly limits; token rotation and replay family revocation; device listing/logout-others; single-use password recovery and session revocation; password change; production rejection of development configuration. Original tests retain ledger balancing, immutable history, beneficiary ownership, duplicate chain-event protection and payout snapshot constraints.

The HTTP suite runs a real Nest application with controllers, validation, guards and services against PGlite. It does not call production providers or transfer funds. PGlite is not proof of deployed PostgreSQL multi-connection locking/performance; migration advisory-lock/checksum behavior and production backup/restore should also be exercised against the deployment database before release.

## Flutter validation

Flutter 3.47.5 / Dart 3.13.4 was available. The earlier cloud runtime limitation no longer prevents static analysis, Flutter engine widget tests or JS web compilation. Commands use supported CI/BOT environment settings and a persistent pub cache; no permissions or network controls were bypassed.

The original 36-screen regression matrix covers 390×844 iPhone, 412×915 Android, 320×700 with 1.3 text scale, and 844×390 landscape. Phase 3 adds six connected presentations at all four sizes. Tokens refresh once across concurrent 401s; real-mode controller state receives the API profile/masked bank and preserves the exact returned fee/net, keeps wallet/history empty and refuses simulated execution.

One Phase 2 test expectation was deliberately updated: normal main.dart now displays the connected Login screen instead of the old “services are not connected” placeholder. The safety assertions still ensure no financial mock balance or preview bypass is exposed. Existing preview routes/tests remain operational.

UI captures under `previews/` are genuine Flutter widget-engine screenshots using controlled sandbox HTTP fixtures. Backend HTTP behavior is tested separately. They are not screenshots of successful production bank/identity/payout integrations. The overview board only arranges those exact screenshots.

The successful web build reports a Wasm dry-run incompatibility in the existing flutter_secure_storage_web dependency (`dart:html` / `dart:js_util`). The JS build succeeds; a Wasm build is not claimed. No Chrome interaction run, Android installation, iOS installation, signing, push delivery, Face ID or fingerprint hardware run is claimed.

## Commands and evidence

```sh
npm test --workspace @dt/backend
npm run typecheck
npm run tokens:check
flutter analyze --no-pub
flutter test --no-pub --dart-define=DT_CAPTURE=true --reporter expanded
flutter build web --release --no-pub --dart-define=API_BASE_URL=https://api.dt-exchange.example/api/v1
flutter build apk --debug --no-pub
```

The example web API host is an intentionally non-operational `.example` domain, used only for compilation. Configure a real trusted HTTPS endpoint when deploying.

Logs in `validation/` include backend tests, Flutter tests/analysis/web build, TypeScript, token checks, Android build limitation and source preservation. The implementation was corrected after initial test failures in verification enum parameter casting and PGlite integer serialization; final results above are from the passing runs.

No real blockchain processing, wallet-key custody, deposit credit or INR payout was started. Phase 4 remains unimplemented.

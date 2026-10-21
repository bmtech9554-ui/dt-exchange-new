# Phase 4 test results

Validation date: 20 September 2026. Tests run against the existing project with the additive Phase 4 implementation. No real funds, live custody or payout provider were used.

| Check | Result | Evidence |
| --- | --- | --- |
| Backend tests, including Phase 1–3 regression suite | **68 passed** | `validation/backend-tests.log` |
| Flutter tests, including all 186 prior tests | **214 passed** | `validation/flutter-tests.log` |
| New API-backed responsive screen tests | **28 passed**, included above | `validation/flutter-phase4.log` |
| `flutter analyze` | **No issues found** | `validation/flutter-analyze.log` |
| Backend TypeScript and Next.js production builds | **Passed** | `validation/build-all.log` |
| Flutter JS/CanvasKit release web build | **Passed** | `validation/flutter-web-build.log` |
| Design token drift check | **Passed** | `validation/tokens.log` |
| Phase 3 protected-source hashes | **20/20 unchanged** | `validation/design-preservation.json` |
| Android debug build | **Blocked: Android SDK absent** | `validation/flutter-android-build.log` |
| iOS native build/device run | **Unavailable: Linux environment; no Xcode/macOS** | Not claimed as tested |
| PostgreSQL server contention and Redis/BullMQ runtime | **Not executed: server binaries/Docker unavailable** | PGlite validates SQL behavior; queue runtime remains external |
| Live TRON RPC/indexer and external custody gateway | **Not executed: no configured credentials/gateway** | Adapter response-fixture tests only |

## Backend coverage

There are 12 retained foundation/schema tests, 29 retained Phase 3 tests and 27 new Phase 4 tests. The HTTP tests use actual Nest controllers, global guards, DTO validation and application services with PostgreSQL WASM (PGlite), rather than replacing financial services with mock assertions.

Phase 4 checks include:

- Atomic quote acceptance, accepted rate preservation, permanent quote single use and same-key replay.
- Used/expired quote rejection, wall-clock expiry and rechecking changed verification eligibility.
- Cross-user quote/order/deposit-detail access rejection and bank mismatch rejection.
- Successful TRC20 matching, confirmation progression and no credit before the threshold.
- Ledger balancing by asset, derived available/pending balances, wallet-funded sale and duplicate-hash replay.
- Wrong contract, network and recipient; failed execution; underpayment, overpayment, late/expired-order payments and multiple official transfers in a hash.
- Reorg reversal idempotency and no generated payout records.
- Illegal transition rejection at the database boundary.
- History pagination, order details, deposit details and no fabricated payout history.
- Cursor replay, failed pending transactions leaving the confirmation queue, retired-address rejection and manual review.
- Admin/mobile session separation, permission checks, revocation, audited review acknowledgement, and a TOTP reference vector.
- Base58Check validation, RPC receipt decoding and inconsistent provider transaction identity rejection.
- Actual migration runner applied twice on a fresh database with four migration checksums retained. A PGlite simple-query adapter is used for multi-statement migration execution.

The migration, ledger and ownership assertions exercise real PostgreSQL constraints in PGlite. They do **not** establish separate-process PostgreSQL locking behavior, provider finality guarantees or Redis worker recovery under process loss. Those remain deployment validation requirements.

## Flutter runtime and visual coverage

The new tests exercise normal API mode through a fixture HTTP adapter at iPhone 390×844, Android 412×915, small-screen 320×700 with 1.3× text, and landscape 844×390. They scroll the screens and check for Flutter layout/runtime exceptions. They cover Confirm, Send, Progress, Wallet, History, Deposit and deposit detail.

Behavior checks verify that Confirm posts only the owned quote/bank identifiers with an idempotency key; the sent button performs reads rather than financial mutations; ready-for-payout tracking stops automatic polling and removes funding instructions; and no simulated completion button appears in API mode. Existing authentication, route, responsive-screen and preview-domain tests remain passing.

The preview PNGs are actual Flutter widget renders from this API fixture path. Their amounts and non-payable addresses are labelled sandbox data. They are not photographs of physical devices or evidence of live blockchain/payout activity. Capture waits for card/QR reveal animations; the preserved core logo, colors, navigation and Profile files are independently hash-checked.

The web release target compiled successfully. The dependency `flutter_secure_storage_web` produces the existing WebAssembly dry-run incompatibility warnings (`dart:html` / JS interop); the tested JS/CanvasKit build still succeeds. WebAssembly itself was not certified or shipped as the validated target.

## Security review performed

Reviewed provider boundaries, strict contract/recipient matching, ownership checks, exact token-unit arithmetic, quote/transaction locks, permanent financial idempotency, immutable snapshots/journals, reversible reorg accounting, rate limits, admin separation, MFA replay prevention, safe errors, credential handling and cookie/Origin behavior.

The code contains no wallet signing implementation or hardcoded production private key. The package excludes local environment secrets, dependencies and compiled caches. Custody keys remain outside the application behind the gateway port. No unsigned deposit webhook exists.

## Reproduction

```sh
npm ci
npm test
npm run build
npm run tokens:check
cd mobile
flutter pub get
flutter analyze
flutter test
flutter test test/phase4_api_test.dart --dart-define=DT_CAPTURE=true
flutter build web --release --dart-define=API_BASE_URL=https://YOUR_API_HOST/api/v1
# Requires Android SDK:
flutter build apk --debug
```

Phase 5 was not started. Confirmed sales remain READY_FOR_PAYOUT; there is no executed INR payout or fabricated completion reference.

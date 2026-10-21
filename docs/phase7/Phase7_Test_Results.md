# Phase 7 test results

Validation date: 21 September 2026. Node.js 24.19.0; Flutter 3.47.5 / Dart 3.13.4; Linux x86_64. Evidence is retained under `docs/phase7/validation/`.

| Check | Result | Evidence/limitations |
| --- | --- | --- |
| Backend complete regression + Phase 7 | **126 passed, 0 failed, 0 skipped** | `backend-tests.log`; includes all 112 retained Phase 1–6 cases and 14 new Phase 7 cases |
| Flutter tests | **255 passed** | `flutter-tests.log`; 254 retained cases + maintenance error sanitization |
| Flutter analyze | **0 issues** | `flutter-analyze.log` |
| Admin tests | **12 passed, 0 failed** | `admin-tests.log`; 11 actual React SSR cases and one BFF source invariant check; not browser interaction tests |
| Backend/admin TypeScript | **Passed** | `typecheck.log` |
| Backend build | **Passed** | Build stage in `backend-tests.log` |
| Next.js production build | **Passed** | `admin-build.log`; static routes and BFF compiled |
| Flutter web release | **Passed** | `flutter-web-build.log`; JavaScript release output; Wasm dry-run warnings remain in secure-storage web dependency |
| Android release APK | **Blocked** | `flutter-android-build.log`: “No Android SDK found. Try setting the ANDROID_HOME environment variable.” |
| iOS native build | **Not run** | Linux host; no macOS/Xcode or signing credentials |
| Migration application/reapplication | **Passed within backend suite** | Seven migrations applied and rerun; delivered migrations 001–006 unchanged |
| Financial concurrency fixture tests | **Passed in PGlite** | Eight-way quote/order/deposit/payout/reward cases retained; does not establish multi-process PostgreSQL behavior |
| Live PostgreSQL | **NOT_VALIDATED** | No server/URL; disposable real-service harness and CI job supplied |
| Live Redis | **1 explicit skip, 0 failures** | `redis-integration.log`; PHASE6_REDIS_URL absent |
| npm dependency audit | **0 reported vulnerabilities** | `dependency-audit.json`; no unsupported major-version upgrades made |
| Source credential pattern scan | **0 findings** | `source-security.json`; not a full secret/history audit |
| Brand/navigation preservation | **52 protected files unchanged** | `visual-and-financial-baseline.json`; entire existing mobile library except error-message helper compared to Phase 6 archive, plus protected assets/schema |
| Design-token drift | **Passed** | `tokens.log` |
| YAML/plist parsing and shell/JS syntax | **Passed** | Configuration parsing and syntax commands; not Docker/Nginx/Prometheus runtime validation |
| Browser runtime | **NOT_VALIDATED** | No browser binary or browser-control tool; actual React SSR preview supplied |
| Backup/restore/PITR | **NOT_VALIDATED** | pg_dump/age/live DB absent; scripts and runbook supplied, no successful backup claimed |
| External providers | **MOCK / NOT_VALIDATED** | No vendor sandbox/live credentials, real transfers or delivery |
| Production deployment | **Not performed** | Startup intentionally rejects unregistered real adapters |

## New backend coverage

Explicit admin permissions; public safe operational status; paused quote rollback/idempotency; concurrent configuration updates; read-only registration/support blocking with account reads; payout submission pause; signed sandbox completion during maintenance; provider readiness truthfulness; masked bank response and freeze/session revocation; production configuration rejection; immutable ledger; policy versions preserving quotes; schema-correct admin views; ledger audit and queue prefix validation.

The initial operational trigger regression and fresh-database role-registration issue were fixed, then the complete suite was rerun. No failing test was removed or bypassed. Existing test expectations changed only to reflect migration count 7 and health phase 7.

## Reproduce available checks

```sh
npm ci --ignore-scripts
npm run tokens:check
npm run typecheck
npm test
npm run test --workspace @dt/admin
npm run build
npm audit --json
node scripts/security-check.mjs
cd mobile
flutter analyze
flutter test
flutter build web --release --no-web-resources-cdn --dart-define=API_BASE_URL=https://api.example.invalid/api/v1
```

See the live-infrastructure/native reports for commands requiring external SDKs or services. CI configuration is prepared but has not been run on a remote CI host. Synthetic successful payout/UTR evidence remains explicitly sandbox-labelled.

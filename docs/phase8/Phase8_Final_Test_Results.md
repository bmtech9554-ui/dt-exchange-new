# Phase 8 final test results

DT Exchange RC1 · 1.0.0-rc.1

| Validation | Phase 7 baseline rerun | RC1 final | Evidence |
|---|---:|---:|---|
| Backend | 126 passed | **141 passed, 0 failed, 0 skipped** | validation/backend-final.log |
| Flutter | 255 passed | **260 passed** | validation/flutter-tests-final.log |
| Admin | 12 passed | **12 passed, 0 failed** | validation/admin-final.log |
| Flutter analysis | 0 issues | **0 issues** | validation/flutter-analyze-final.log |
| TypeScript checks | Passed | **Passed** | validation/typecheck-final.log |
| Backend + Next build | Previous build verified by baseline manifest | **Passed** | validation/build-final.log |
| Flutter JavaScript web release | Previous build verified by baseline manifest | **Passed** | validation/flutter-web-final.log |
| Redis integration/recovery | Not live-validated | **2 skipped; 0 executed** | validation/redis-acceptance.log |
| Android release appbundle | SDK absent | **NOT_VALIDATED** | validation/android-build.log |
| iOS release | Linux host | **NOT_VALIDATED** | macOS/Xcode unavailable |
| npm advisory audit | 0 advisories | **0 advisories** | validation/npm-audit.json |
| Source/artifact scanning | Limited pattern scan | See final JSON scan reports | validation/secret-scan.json; archive scan receipt |

Counts increased by 15 backend tests (12 release-security/evidence gates and 3 lifecycle/replay/ledger tests) and 5 Flutter network/error tests. No previous test was deleted. The Phase 7 configuration test retains its assertions; its deliberately weak fixture service/provider values were strengthened so it can reach the existing unregistered-adapter refusal under the new checks.

The first RC test iterations exposed test-fixture errors (base64 encoding and a nonexistent ordering column). Those fixture errors were corrected, no failing assertion was removed, and the complete final backend suite passed. Initial logs are not final acceptance evidence.

All SQL migrations 001–007 run in the existing backend suite with constraint, ledger and idempotency checks. No Phase 8 migration was needed. PGlite is PostgreSQL-compatible WASM, not proof of independent server connection concurrency. No live PostgreSQL/Redis, staging deployment, vendor sandbox, native signing, browser interaction, restore/PITR or crash drill was validated.

Commands from repository root:

```sh
npm ci --ignore-scripts
npm run tokens:check
npm run typecheck
npm test
npm run test --workspace @dt/admin
npm run build
npm audit --audit-level=high
node scripts/security-check.mjs
python3 scripts/release-secret-scan.py .
node --test backend/test/redis-integration.mjs backend/test/phase8-redis-recovery.mjs
```

From mobile: `flutter pub get`, `flutter analyze`, `flutter test`, `flutter build web --release --no-web-resources-cdn --dart-define=API_BASE_URL=https://api.example.invalid/api/v1`. The example URL is a compile-only placeholder, not a deployed endpoint. Use scripts/native-release.sh for a configured signed native build.

Warnings: 20 Flutter packages have newer versions outside current constraints; no major upgrades were forced. The JavaScript web build passes, but WebAssembly dry-run reports existing secure-storage web dart:html/js compatibility limitations. WASM release is not claimed. npm reports an environment http-proxy configuration deprecation; it does not fail the builds. No Android SDK is available; no AAB was produced.

The Phase 7 manifest matched all 530 files before work. validation/preservation.json records the final changed-file inventory and confirms protected mobile UI/assets, admin source, brand and migrations are unchanged. Store/device accessibility and performance acceptance remain external; local fixture timings are not production latency guarantees.

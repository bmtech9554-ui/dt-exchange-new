# Final production setup test results

Baseline: Phase 8 RC1. All 592 manifest entries matched before editing.

| Check | Current result | Evidence |
|---|---|---|
| Backend regression | **149 passed, 0 failed, 0 skipped** | validation/backend-tests.log |
| Flutter tests | **260 passed** | validation/flutter-tests.log |
| Admin checks | **12 passed, 0 failed** | validation/admin-tests.log |
| Flutter analysis | **0 issues** | validation/flutter-analyze.log |
| Backend/admin TypeScript | **Passed** | validation/typecheck.log |
| Backend and Next builds | **Passed** | validation/build.log |
| Flutter JavaScript web release | **Passed** | validation/flutter-web.log |
| npm advisory audit | **0 advisories** | validation/npm-audit.json |
| Source secret-pattern scan | **0 findings** within limited scope | validation/secret-scan.json |
| Redis retry/recovery | **2 skipped, 0 executed** | validation/redis-tests.log |
| Android appbundle | **NOT_VALIDATED — no Android SDK** | validation/android-build.log |
| iOS | **IOS_BUILD_PENDING — Linux, no Xcode** | validation/inspection.json |
| Live PostgreSQL, staging, providers, restore and monitoring | **NOT_VALIDATED** | Per-subtask reports |

The backend count increased from 141 to 149 with eight final-configuration tests. Flutter/admin counts remain 260/12. No prior test was removed or changed. Existing migration/constraint tests execute migrations 001–007 in the SQL fixture suite; no new migration was introduced.

Financial replay, quote/order ownership, limits, blockchain contract/recipient/confirmations, payout idempotency/reversal, referral rewards, audit immutability and ledger balancing remain covered. The local RC1 E2E prints MOCK status, a sandbox-only payout reference, five ledger journals and zero integrity issues. Its observed lifecycle body took 1166 ms in this run; that is a local fixture timing, not staging latency or a production SLA.

Reproduction from repository root:

```sh
npm run tokens:check
npm run typecheck
npm test
npm run test --workspace @dt/admin
npm run build
npm audit --audit-level=high
node scripts/security-check.mjs
python3 scripts/release-secret-scan.py .
node backend/scripts/configuration-report.mjs
node --test backend/test/redis-integration.mjs backend/test/phase8-redis-recovery.mjs
```

The configuration checker intentionally exits 2 while inputs are missing. Redis tests intentionally skip without a test URL. Neither is production acceptance.

Flutter used the already installed/locked dependencies: `flutter analyze --no-pub`, `flutter test --no-pub`, and `flutter build web --release --no-pub --no-web-resources-cdn --dart-define=API_BASE_URL=https://api.example.invalid/api/v1`. The URL is a compile-only placeholder, not a deployed domain. The appbundle attempt with the same HTTPS placeholder failed because Android SDK is absent. We did not run flutter clean or create signing keys in an environment unable to build native artifacts. Use the existing native-release script on the configured build machine for clean/pub get/tests/signing.

Warnings retained: npm environment http-proxy deprecation; existing secure-storage web dependencies fail the optional WASM dry-run while the requested JavaScript release succeeds. No WASM/native build success is claimed. Browser interaction, physical-device accessibility/performance, live TLS/authentication, abrupt recovery and provider sandbox tests remain external acceptance tasks.

The source/ZIP scanners inspect recognizable secret patterns, configured literals and prohibited files without printing secrets. No Git history exists; unknown secret formats or text embedded in images are not exhaustively certified. The final archive scan and checksum are delivered separately.

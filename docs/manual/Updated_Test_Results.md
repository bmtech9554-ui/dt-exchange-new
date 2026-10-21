# Updated test results — Manual Android release

Final status: **BLOCKED_FOR_PRODUCTION**. No production deployment or real INR/USDT transfer occurred.

| Validation | Result | Evidence |
|---|---|---|
| Backend full regression | **168 passed / 0 failed / 0 skipped** | `validation/backend-regression.log` |
| Flutter full regression | **288 passed** | `validation/flutter-regression.log` |
| Admin checks | **17 passed / 0 failed** | `validation/admin-tests.log` |
| Flutter static analysis | **0 issues** | `validation/flutter-analyze.log` |
| Backend TypeScript build | PASS (part of full regression) | Backend regression log |
| Admin TypeScript / production build | PASS | `validation/admin-typecheck.log`, `admin-build.log` |
| Flutter JavaScript web release build | PASS | `validation/flutter-web-build.log` |
| New mobile preview/layout checks | **16 passed**, 390 px and 320 px | `validation/mobile-previews.log` |
| Migration application and replay | PASS, all **8** migrations | Full regression migration-runner case |
| Ledger integrity in manual fixture lifecycle | PASS, **zero audit issues** | Manual ledger-audit case in full regression |
| Concurrent manual approvals and confirmations | PASS in PGlite transaction harness | Manual regression cases |
| Design-token generation | PASS | `validation/design-tokens.log` |
| Approved logo, colors, router and Profile source | Byte-for-byte unchanged from Final Setup manifest | `validation/design-lock.json` |
| Dependency audit | npm reports **0 vulnerabilities** at this run | `validation/dependency-audit.json` |
| Source pattern / secret scan | No findings in scanned source | `validation/security-source.json`, `secret-source.json` |
| APK release-script shell syntax | PASS (`bash -n`) | Build execution remains external |
| Android native build | **NOT_VALIDATED** — build attempt stopped: “No Android SDK found” | `validation/android-build-attempt.log` |
| Android signing / APK hash / APK size | **ANDROID_SIGNING_PENDING**; no distributable artifact | External keystore, SDK and verified production URLs absent |
| Browser/admin acceptance | **NOT_VALIDATED**; component SSR checks only | Live staging/browser acceptance remains required |
| Live PostgreSQL / Redis / restore / monitoring | **NOT_VALIDATED** in this environment | Infrastructure not supplied |
| iOS / stores | **FUTURE_REQUIREMENT** | Not current release gates |

## Regression accounting

The source baseline inspected for this update had 149 backend tests, 260 Flutter tests and 12 admin checks, preserving the earlier minimum of 141 / 260 / 12. This update adds 19 backend cases, 12 Flutter update-policy tests and 16 Flutter component/layout tests, plus 5 admin checks. No prior tests were removed. The migration-count assertion was updated from seven to eight because migration 008 is additive; the migration runner still applies and safely replays the complete sequence.

Backend cases exercise real Nest controllers/guards/services against PostgreSQL-compatible PGlite, including review without credit, private upload/access, duplicate hash, mandatory verification details, approval/rejection, balanced ledger credit, wallet-only selling, masked bank lists and audited full reveal, evidence-required manual settlement, duplicate/concurrent confirmation, disabled automated calls, signed Android metadata, minimum-version enforcement, immutable evidence, model-specific production checks and manual ledger audit.

A status-history ordering issue was found during regression: two events created in one transaction share the same timestamp. Manual history now has a monotonic sequence, so APPROVED always precedes CREDITED. Visual inspection also found an unconstrained success painter in the new screen; it now uses the existing centered component and a size assertion. Final targeted preview tests pass.

PGlite concurrency tests validate transaction/idempotency behavior in that harness; they do not certify independent PostgreSQL connection contention, TLS, failover or Redis recovery. The CI live-infrastructure job now includes the manual test suite. Run against a dedicated disposable test database, never production:

```bash
npm ci --ignore-scripts
npm run test --workspace @dt/backend
npm run test --workspace @dt/admin
npm run typecheck
npm run build
# Inject a dedicated allowed test DB URL through the secure environment:
node --test backend/test/manual.test.mjs
# PHASE6_POSTGRES_URL switches this test to the existing isolated PostgreSQL harness.
```

Flutter commands: `flutter analyze`, `flutter test`, and `flutter build web --release --no-web-resources-cdn --dart-define=API_BASE_URL=https://api.example.invalid/api/v1` from `mobile/`. The `.invalid` host is a compile-only placeholder, not a deployable production configuration. Web build logs contain existing secure-storage/JavaScript interop warnings from the optional WASM dry run; the JavaScript web build succeeds. No WASM release is certified.

UI delivery includes eight rendered Flutter PNGs and four static server-rendered admin/website HTML previews. All transaction/receipt values in previews are synthetic and clearly identified. The combined preview gallery is self-contained. Static component previews are not real-browser acceptance.

The release archive is separately scanned and hashed after packaging. Secret scans do not certify unavailable Git history or every unknown credential embedded in arbitrary binary content. No APK checksum is invented in the absence of a signed APK.

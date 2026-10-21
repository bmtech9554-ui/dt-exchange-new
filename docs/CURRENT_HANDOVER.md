# DT Exchange continuation — 20 October 2026

## Latest continuation

### Build 8023 simulation candidate — 21 October 2026

Build 8022 completed its physical deposit-to-payout simulation, history, receipt
download, theme, Telegram handoff and coin-motion checks. Biometric verification
was user-assisted. See [device evidence](ANDROID_8022_VERIFICATION_20261021.md).

Build 8023 is compiled locally with the original package and isolated test API.
It includes shared authoritative wallet refresh after credited deposits and
wallet reads, fresh Sell wallet/bank loading, wallet funding in manual mode,
and re-quoting after returning from Add Bank. These changes preserve the UI
and do not change server financial safeguards.

Candidate manifest: `.audit/local-android-candidate-8023.json`. Candidate hash,
package, version, compiled endpoint and existing signing identity passed the
signer's validation-only checks. The original signed 8022 APK is preserved;
its unsigned candidate is preserved under `mobile/build/verified-8022/`.
All 23 tests with the exact simulation defines and the full 408-test Flutter
suite passed; static analysis found no issues.

Signing completed through the owner's masked local prompt. Independently verified
SHA-256: `2db87cae34cdc3da7cc7f587e2332e6f3d41cefbdabea3d22d9c645c6e0286fa`.
APK: `.audit/local-android/DTExchange-8023-signed.apk`.
Android v2/v3 signatures verify against the original certificate
`475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c`.
Package/version confirmed as `com.dtexchange.dt_exchange` / `8023`.
All three signed Flutter ABI libraries contain the isolated test endpoint and
neither the placeholder nor production API endpoint.

Device upgrade and retained-session verification are pending: Windows USB and ADB
did not detect the Samsung at the post-signing check. No installation was attempted,
no data was cleared, and no candidate is published.

The signing helper accepts only reviewed simulation versions 8022/8023 and
retains all integrity and original-certificate checks. Candidate-specific signed
metadata avoids overwriting the earlier signed record. Use the manifest argument
for 8023; the default still selects preserved 8022.

### Production transition audit and hardening

See [Production transition audit — 20 October 2026](PRODUCTION_TRANSITION_20261020.md).
Real-network manual deposit approval now requires independent read-only TRON
corroboration and records the actual event index. Production manual mode no longer
waives customer or bank verification. The admin evidence timestamp supports
milliseconds; obsolete unreachable wallet-placeholder text was removed.

Fresh validation: **320 backend, 60 admin, 405 Flutter and 93 isolated
PostgreSQL/Redis integration tests passed**. Flutter analysis and admin TypeScript
checks passed; design tokens match. Production public terms were read without
writes and confirm rate 103 and maximum sell 5,000.

Production transition remains **INCOMPLETE**: real identity/risk integration,
bank-review operating acceptance, approved RPC/custody and live infrastructure
acceptance are outstanding. No server deployment, production-data mutation,
financial activation or publication occurred. Installed Build 8022 is unchanged;
8023 is proposed only, not built or signed. The earlier Samsung verification
reached registration and the Deposit screen; full physical-device end-to-end
approval/payout verification remains incomplete.

### Build 8022 signing repair

`Get-FileHash` was unavailable in the interactive Windows PowerShell signing process. Both hash operations now use `scripts/file-sha256.ps1`, a streaming .NET SHA-256 implementation with deterministic disposal of file handles. `scripts/test-file-sha256.ps1` passed under Windows PowerShell with `Get-FileHash` deliberately disabled. The actual signing script also rejected tampered APK bytes and a production endpoint before requesting any password.

The APK was recompiled as the existing simulation variant, build 8022, retaining `com.dtexchange.dt_exchange`. It now targets `https://dtexchange.app/test-api/api/v1`, replacing the compile-only placeholder. All compiled ABI libraries were checked for that endpoint and absence of the placeholder and production API URL. A read-only HTTPS status request returned `PUBLIC_SOFTWARE_TEST` and `realMoney:false`; this is not a fresh infrastructure/security audit of the remote service. Production credentials remain in a separate storage namespace.

Windows PowerShell `sign-local-android.ps1 -ValidateOnly` passed. Fresh checks passed: 405 Flutter tests, six tests with the exact simulation defines, and 93 disposable PostgreSQL/Redis integration tests. Local masked password entry completed signing. No signing password was logged, saved or sent to chat. No server configuration or public APK was changed.

Signed APK: `.audit/local-android/DTExchange-8022-signed.apk`. Final SHA-256 independently verified with Node:
`cbd751c6442f6d140f6754d64f69e7ec1c7a93cb0c169fde35b4aec38c0bb4ee`.
Android `apksigner` verified v2 and v3 signatures against the original certificate. Samsung installation via `adb install -r` returned `Success`; package manager reports build 8022 and retained the original installation date. `am start -W` returned `Status: ok`, and the app process is running. No uninstall or data clear occurred. Visual startup verification passed after normal device unlock: the DT Exchange sign-in screen, original logo and SIMULATION — NO REAL USDT OR INR banner are visible. Evidence: `.audit/local-android/samsung-8022.png`. Physical-device financial workflows remain untested in this pass.

The earlier compilation-only candidate details below are historical; use `.audit/local-android-candidate.json` for the current simulation candidate.

The recovered folder is the working baseline. GitHub is optional and is not a blocker for local work.

- Reviewed the initial 20-file change set (16 modified baseline files and four additions).
- Added migration `023_manual_failed_recovery.sql` and evidence-backed recovery for definitively failed manual payouts and rejected, unprocessed wallet orders. Recovery requires `PAYOUT_CONFIRM` and `payouts.review`, privately uploaded evidence, explicit no-transfer attestation and enabled financial controls.
- Recovery serializes on the wallet owner/order, reverses original reserve/sell/fee journals exactly once, retains immutable originals and audit evidence, and cancels the order. Refunded orders cannot be reopened. Uncertain outcomes cannot be refunded. Existing account risk flags remain subject to explicit review.
- Admin recovery controls and the customer wallet-restoration message use existing UI components. History and receipt access continue through authenticated APIs.
- Current checks: **297 backend, 405 Flutter, 60 admin tests passed**, Flutter analysis clean, admin TypeScript/build passed. **93 PostgreSQL/Redis integration tests passed**; the final refunded-order terminal guard additionally passed all **52 manual tests on PostgreSQL**.
- PostgreSQL 16.15 ran in a disposable password-protected loopback cluster. Redis 7.2.8 used a community Windows build in a disposable loopback process. No production connection was used. Linux deployment acceptance remains distinct from these Windows integration checks.
- Browser recovery flow passed at 1366×900 and 390×900 with synthetic intercepted responses, no console errors and no unexpected network requests. Evidence is outside source at `C:\DTExchange\qa-20261020`.
- Final Android release compilation succeeded with `--build-number=8022`, `APP_VERSION_CODE=8022` and `https://api.example.invalid/api/v1`. The artifact is **unsigned**, not operationally ready, and not published or installed.
- Original keystore found: `C:\Users\Ashik\.dtexchange-signing\production\android-production.p12`. No signing password or private key was displayed or changed.
- Original certificate SHA-256: `475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c`. It matches the verified backup APKs and the Samsung's installed APK.
- Nineteen APK copies verified with the original signer; highest existing signed build is **8021**. Connected Samsung SM F956B has **8018**. Proposed next build is **8022**.
- Historical production endpoint: `https://api.dtexchange.app/api/v1`, from the backed-up `.tools/sign-production-release.py:100`. Simulation endpoint: `https://dtexchange.app/test-api/api/v1`, from `.tools/sign-simulation-release-8021.py:102` and `mobile/lib/public_test/test_mode.dart`. These are configuration findings, not authorization for network tests.
- `scripts/sign-local-android.ps1` prepares masked local password entry and validates the candidate hash, package/version and original signing certificate. It signs only the compile-only candidate; it never installs or publishes. Its syntax was checked; signing remains unexecuted.

Remaining release requirements: unlock the existing keystore locally; approve and verify the intended isolated test endpoint; sign and verify a candidate for that endpoint; verify Samsung installation, upgrade/session retention and device workflows; complete operating verification before any real customer funds are enabled. Cloudzy, production data and the existing public APK remain untouched.

The sections below are the earlier audit snapshot; the latest continuation above supersedes their remaining-work and test-count statements.

This document describes the current local continuation. Older release and deployment reports are historical evidence, not confirmation of current production state.

## Source identity

- Original supplied folder: `C:\DTExchange\dt-exchange`, build 8002.
- Active recovered source: `C:\DTExchange\recovered-8018-8021`, Flutter version `1.0.0+8018`.
- Recovery archive: `C:\Users\Ashik\Downloads\dtexchange update\DT_Exchange_UI_Manual_Deposit_Update (2).zip`.
- Archive SHA-256: `8f9f84648f6225cb97ebb62344c4b73dda311e7df58189343b4b53198bca8276`.
- Archive 8018 APK SHA-256: `e671fa441f37e1dc90914ec886a82aca9c16f894fe7407fb151f2262df35aef8`.
- Archive 8021 simulation APK SHA-256: `158de74fd4df2288f8021fda912839aeed610605e8153a653ae9871710bced63`.

The archive contains 8021 simulation artifacts; that does not establish that its 8018-labelled source exactly reproduces them. No original Git commit has been established. Recovery inventories and local logs are under `.audit/`, excluded from Git.

The connected GitHub account is `bmtech9554-ui`. Its accessible `Bm` repository belongs to Nila Wallet. The owner will provide the existing DT Exchange repository URL. No source has been pushed and no repository has been created.

## Implemented locally after the source audit

1. Reviewed manual payouts can be completed against verified payment evidence with both `PAYOUT_CONFIRM` and `payouts.review`. Existing exact-amount, receipt ownership, bank attestation, timestamp, execution-gate and ledger checks remain. Concurrent confirmation posts one settlement; conflicting retries are rejected.
2. Additive migration `022_manual_review_settlement.sql` permits the specific evidenced manual-review completion transition. It was applied only to disposable test databases. Uncertain payments cannot be restarted through this path.
3. The existing admin payout form now exposes review completion and explains that the existing transfer must be verified. Branding, navigation, logo and animation assets were preserved.
4. History pagination retains the filtered total when the requested page is empty.
5. API version headers and Android update checks share the same version value. Release startup requires an explicit positive `APP_VERSION_CODE`; release scripts supply it alongside the native build number. The local development fallback is 8018. This does not verify a newly signed APK.
6. The ledger operations audit compares fee-bearing deposits with recorded net wallet credit, falling back to verified gross amount for legacy records without a net amount.
7. Public-test receipt fixtures now use the included synthetic asset rather than a temporary tools directory.

## Validation

| Check | Result |
| --- | --- |
| Backend compilation and complete suite | 295 passed, zero failed or skipped |
| Flutter suite | 405 passed |
| Flutter static analysis | No issues |
| Admin suite | 59 passed |
| Admin TypeScript check | Passed |
| Admin/website production compilation | Passed locally |
| Canonical design tokens | Match |
| Source secret-pattern scan | No findings; limited pattern scan |
| Deposit audit regression | Valid fee deposits pass; missing credits are detected |
| Browser review completion | Passed at 1366×900 and 390×844 |

Financial tests use disposable PGlite databases and synthetic transfers. Browser tests use intercepted synthetic API responses: receipt upload, required evidence, confirmation and completed state were exercised without external requests, browser errors or warnings. These checks do not establish real PostgreSQL locking behavior or real bank settlement.

Local evidence: `.audit/backend-final.log`, `flutter-development-tests.log`, `flutter-development-analyze.log`, `admin-development-tests.log`, `admin-final-build.log`, `manual-review-browser.json`, `manual-review-1366.png`, and `manual-review-390.png`.

## Remaining work and release gates

- Reconcile this source against the user-provided DT Exchange GitHub repository, establish provenance, and run its CI. Never replace the unrelated Nila Wallet repository.
- Define and implement recovery for definitively failed/rejected manual payouts. Existing liability retention remains; no automatic refund or transfer retry was added. An uncertain bank outcome must remain under review.
- Run the real PostgreSQL/Redis integration and recovery suites on disposable infrastructure. Docker, psql and redis-server were not available on PATH in this session.
- Complete operational acceptance of OTP, chain evidence, bank verification, evidence storage, key recovery, backups, monitoring and provider failure handling.
- Build and verify a signed Android candidate with approved identity, endpoint and flags; test upgrade/session retention and complete workflows on a physical device. No new release APK was built or published.
- Production activation requires explicit owner authorization. No production VPS, database or public APK was changed. Financial gates, RBAC, evidence requirements and immutable ledger controls remain in place.

The passing local checks cover the changes above. They do not mean every remaining app function or production release requirement is complete.

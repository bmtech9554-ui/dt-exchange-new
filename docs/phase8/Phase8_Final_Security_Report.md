# Final security release gate

DT Exchange RC1 · 1.0.0-rc.1 · Phase 8

Scope: Phase 7 baseline review plus RC configuration/evidence gates, local regression, source/archive pattern scanning and dependency advisory scan. This is not an independent penetration test. No Git history is present; historic secret absence cannot be certified. Unknown credential formats and text inside raster images are not exhaustively detectable by the scanner.

| Severity | Finding / status | Release treatment |
|---|---|---|
| HIGH | Real adapters, live financial concurrency and recovery evidence absent | Unresolved release blocker; production remains fail-closed, no mitigation approval assumed |
| MEDIUM | RC production config lacked explicit JWT pairing/default credential/debug checks | Fixed; new automated tests exercise rejection |
| MEDIUM | Native signing/device and interactive browser acceptance absent | Manual release gate; no build-pass claim |
| LOW | CI action/image digest pinning and container scan require release infrastructure | Retain checklist gate; no blind major upgrades |
| INFO | Local npm audit reported zero advisories; pattern scans found no recognized secrets | Limited point-in-time evidence, not universal proof |

No newly identified unresolved code-level CRITICAL issue is claimed from this review. External HIGH validation gaps remain and block certification.

Reviewed areas: scrypt credentials/PIN and OTP expiry/attempt limits; refresh rotation/replay revocation; user ownership and separate admin RBAC/MFA sessions; rate limiting; integer/decimal financial values; unique quote/order/deposit/payout/referral event keys; transaction boundaries; signed webhook freshness/event deduplication; immutable balanced journals and reversals; private bank/KYC/support storage boundaries; secret-file loading; safe structured error/log handling; DB/Redis TLS readiness; bounded worker retries/shutdown; mobile secure storage and release HTTPS.

Bank responses remain masked. Admin sensitive operations require role, reason and audit; no casual mark-success action exists. No raw private key custody was added. Provider success still requires final provider evidence; sandbox UTRs remain visibly sandbox-only. Existing in-flight claims may complete after a feature pause, so operations must reconcile them.

Run `python3 scripts/release-secret-scan.py .` and repeat against the final ZIP. The scanner checks forbidden secret/signing files, recognizable key/token formats and configured secret literals without printing their contents. Run `node scripts/security-check.mjs` and `npm audit --audit-level=high`. Native dependency/SDK and container-image scanning remain external gates. Source archive excludes real .env, signing files, caches and dependencies.

Technical compliance checklist: configure verification requirements, approved rate/fee/limit policy, audit retention, risk flags, freeze/suspend permissions, financial reports, suspicious-activity review ownership, deletion/retention policy and provider data processing. Organizational/legal authorization and store jurisdiction eligibility remain external requirements, not granted by this report.

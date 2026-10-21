# Separate public software-test release — 13 October 2026

Status: **backend/web test workflow verified; signed APK and physical-device publication gate pending**.

The new request authorizes an additive public software-test service. The earlier
normal-user financial activation candidate is not activated by this work.
Production financial configuration, credentials, balances, database, API/worker
containers and stable signed Android Build 8011 remain unchanged.

## Prepared Android variant

- Version 1.0.0, build 8019, package `com.dtexchange.dt_exchange.publictest`.
- Existing signing identity only; the secure terminal currently awaits its password.
- Exclusive HTTPS API: `https://dtexchange.app/test-api/api/v1`.
- The API client rejects other origins/paths and refuses redirects. Gradle requires
  the test package and Dart test flag to agree. Production sessions are separate.
- Permanent **TEST MODE — NO REAL USDT OR INR** banner; generated non-payable bank
  details and simulated references; no receiving-wallet QR or real wallet address.
- The ordinary DT Exchange application/package and approved branding stay intact.
- No test APK is available for download yet. Samsung installation/flow validation
  must run after signing. ADB currently reports no connected device.

## Deployed additive infrastructure

Only the existing Cloudzy VPS is used. A separate Compose project has a PostgreSQL
database, API and test web container. Each is limited to 512 MiB, with CPU/process
and log caps. No container port is publicly bound. Nginx exposes only explicit test
paths, alongside the original production routes.

The internal `172.31.118.0/24` bridge has scoped host/egress firewall rules. Live
connection probes from the test API were denied to production PostgreSQL, Redis,
API, host SSH, the VPS public HTTPS address and an external HTTPS address. No
production volume, runtime environment, database or provider credentials are
mounted. Fresh test-only encryption and signing secrets remain on the VPS.

The test environment deliberately enables its own simulated transaction state
machine. Its isolated journals have no monetary value. Mock chain evidence and
`SIMULATED-...` payout references are confined to this database. Real provider
access and both automation flags are disabled. Production financial flags are
unchanged, including `TRANSACTIONS_ENABLED=false` and `PAYOUTS_ENABLED=false`.

Demo policy: rate 103 INR/USDT, deposit minimum 100, daily deposit 20,000, no monthly
deposit cap; sell minimum 100, maximum 5,000, daily 20,000, monthly 100,000; no fees;
60-second quotes; manual demo payout ceiling 515,000 INR. Other underlying limits
and audit/idempotency controls remain in place.

There is an initial 1,000-account capacity, 1 MiB/file, 20 files/user and 1 GiB total
encrypted upload budget. Registration/login/request limits and the proxy rate
limit remain active. A resource monitor protects a 40 GiB disk reserve and a
5 GiB test database budget; a threshold breach pauses only test intake.

## Test administrator

The production Owner Admin is unchanged. The separate test console is
`https://dtexchange.app/test-admin`. Browser validation used temporary, subsequently
closed administrators with revoked sessions.

The persistent test-admin password/TOTP setup awaits the user's secure terminal
input. The `public-test-operations` role contains only `DEPOSIT_REVIEW`,
`DEPOSIT_APPROVE`, `PAYOUT_VIEW`, `PAYOUT_PROCESS`, `PAYOUT_CONFIRM`, and `orders.read`
in the **test database**. Test routing blocks settings, production release,
arbitrary wallet adjustment, role-management and provider endpoints. Cookies are
separate, Secure, HttpOnly, SameSite Strict and scoped to the test API path.

## Actual validation

- Backend suite: 288 passed. Admin suite: 57 passed. Admin typecheck/build passed.
- Flutter: analysis clean, 402 ordinary tests passed, plus four compiled test-mode
  tests covering API isolation/redirect rejection and 320/390/768 px layouts.
- Deployed PostgreSQL/API integration: seven tests passed, including registration,
  password login, admin password/TOTP, duplicate rejection, private proof access,
  99 rejection/100 submission, no pre-approval credit, exactly-once demo credit,
  max-sell enforcement, quote math/expiry, simulated payout/receipt linkage,
  exactly-once notifications and balanced per-asset journals.
- Live browser: actual test-admin login, proof viewing/download/hash, deposit
  approval, demo wallet credit, sell processing, receipt upload, simulated payout,
  logout and no page overflow at 390/768/1366 px passed.
- A separate encrypted test backup was authenticated, parsed and restored into a
  disposable recovery database. Ledger integrity issues: zero. The temporary
  recovery database was removed after verification. Production backup untouched.
- Daily test backup and five-minute health/resource timers are enabled. Backup
  storage has a 2 GiB review threshold; no production archive/data is deleted.
- Public website, API, production admin, test page and test console return HTTPS
  200. The actual stable APK was downloaded from the laptop and its hash matches
  Build 8011: `8fa26acc6c86fd18ce9aad40dbc85053f39d71f248aa792267e2eb23d339545b`.

## Publication and rollback gates

The page `https://dtexchange.app/download/test` is live with download withheld.
The homepage Test APK Download link is staged in a standard website build. Its
package is `.tools/test-download-website-prepared.tar.gz`; it is not deployed.
No debug or unsigned test APK is exposed.

1. Finish existing signing prompt; independently verify signer, package, build,
   non-debuggable status, checksum and isolated API in the actual APK.
2. Install alongside the stable app on Samsung without uninstalling or disturbing
   its production session. Complete registration, demo deposit/approval, wallet,
   sell, simulated receipt/History download and test-banner checks.
3. Complete persistent test-admin password/TOTP enrollment in the secure terminal.
4. Run `.tools/prepare-public-test-release.py`; it refuses missing signing/device/
   administrator evidence and does not publish anything.
5. Only after those checks, add exact aliases for the verified test APK, checksum
   and public metadata; activate the prepared website link and independently
   download/hash/signature-check the publicly served test artifact.

Restore the saved Nginx configuration to withdraw the additive test routes. Stop
only `dtexchange-public-test` services if needed; retain their data/backups. The
original production web image and stable APK remain rollback artifacts. Never
replace a production service with a test image or copy production secrets into it.

No Privacy Policy or legal document was created/edited. This test setup makes no
claim of regulatory or financial-service clearance and enables no real-money
activity. Signing/device verification is still required; a browser/API pass is
not represented as an Android physical-device pass.

## Secure-input checkpoint, 2026-10-13

The first signing attempt accepted the existing password and certificate, but
failed during Gradle script compilation: `java.util.Base64` was shadowed by the
Gradle Java extension. An explicit Base64 import fixes the script; `gradlew help
--no-daemon` now passes. No signing identity was changed. The corrected private
signing terminal is waiting for the existing password again; its prior helper
cleared the password on failure.

The isolated database was inspected without revealing credentials: all four
temporary validation administrators are closed, and no administrator created
by the persistent secure setup is committed. The separate enrollment terminal
was reopened. Do not claim enrollment completed until its MFA/access marker is
verified. Production Owner Admin is untouched.

Samsung USB authorization is confirmed. Installation and the full physical
test flow remain pending the signed artifact. The guarded publication helpers
`deployment/public-test/publish.py` and `.tools/publish-public-test-release.py`
are prepared but have NOT run. They require signed/device/admin evidence,
preserve the stable release, constrain Compose changes to the website image,
and restore the prior website/Nginx configuration on validation failure.

# Normal DT Exchange simulation release — 13 October 2026

This supersedes the earlier separate Build 8019 test-app delivery plan. The user
authorized the original DT Exchange name, package, signing identity and existing
website download button. All financial workflows use an isolated demonstration
database and have no monetary value. No real-money activation is authorized.

## Verified

- Build 8020 signed with the existing certificate, non-debuggable, installed as an
  update over 8018 without uninstalling. Its simulated registration and generated
  OTP reached Home on the Samsung. Full remaining phone workflow is not yet passed.
- Isolated backend/admin updates deployed; production API, database, Redis,
  engagement worker, runtime configuration and public 8011 stayed unchanged.
- Actual isolated PostgreSQL/API workflow: 11 checks passed. Includes optional
  deposit proof, duplicate protection, manual demo credit, 103 rate, quote limits,
  wallet-funded sell, simulated payout, entered demo UTR, protected receipt,
  balanced journals, notification uniqueness, OTP expiry/reuse and user freezing.
- Live browser: password/TOTP login, private proof download, manual approval,
  simulated payout with entered UTR, logout; widths 390, 768 and 1366 passed.
- Network probes denied access from the demo API to production API/PostgreSQL/
  Redis, host SSH, VPS public HTTPS and external HTTPS. No production secrets,
  volumes, provider credentials or Docker socket are mounted.
- Fresh encrypted demo backup and actual isolated restoration verified before
  the backend update. Disk reserve, resource caps and monitoring remain active.
- Latest regression: backend 292/292, Flutter 403/403, admin 58/58. Flutter analyze,
  admin typecheck and standard website production build passed.

## Current release gates

- Requested next release is **8021**, version 1.0.0, original package
  `com.dtexchange.dt_exchange`. It is signed and verified with the existing certificate, non-debuggable, and installed as an update. SHA-256: `158de74fd4df2288f8021fda912839aeed610605e8153a653ae9871710bced63`.
- Persistent simulation-admin setup is verified: active account, password/TOTP committed, role access and logout passed.
  Production Owner Admin is unchanged; temporary validation administrators were closed.
- Finish Samsung deposit → approval → wallet → sell → simulated settlement →
  receipt viewing/download, plus other remaining device checks, on the signed 8021.
- Requested physical demo workflow validation passed. The corrected secure administrator prompt completed successfully. Publication completed. Public download hash and signature match; the exact downloaded APK installed as an update and launched Home with the saved demo session.

## Publication and rollback

`deployment/public-test/publish-normal-simulation.py` executed successfully. Official URL: https://dtexchange.app/downloads/DTExchange.apk. Version 1.0.0, Build 8021, 60,058,891 bytes. Website/download/admin/production app configuration/simulation API/simulation admin returned HTTPS 200. Common debug APK paths returned 404. Production API/PostgreSQL/Redis/engagement container identities and runtime configuration remained unchanged. Private Build 8011 rollback is verified.
The local preparation helper requires exact APK hash, certificate, original
package, non-debuggable manifest, isolated endpoint, actual device evidence and
a provisioned simulation administrator. It refuses incomplete evidence.

After gates pass, stage the APK, metadata, validation evidence and verified
website archive in the private VPS publication directory. The publisher checks
health, resource reserve, isolated recovery, old APK and available web rollback
image. It changes only the official APK/checksum and web image. The website keeps
the existing download button and adds the required simulation disclosure. It
does not deploy production API code, migrations or financial settings.

The previous signed 8011 APK and Compose file are copied into a private rollback
directory. On verification failure the script atomically restores the previous
APK/checksum and web image, then verifies health. After success independently
download the public APK, verify hash/signature/build and install that exact file.

The internal `/test-api` path is an isolation namespace, not a separate app or
download button. `/download/test` redirects to the normal download page. APK
credentials are never embedded; demo sessions use a distinct secure-storage
namespace, preserving old production credentials without importing them.

Real blockchain credit, real bank transfers and automatic payouts remain disabled.
No Privacy Policy or legal approval claim has been created by this work.

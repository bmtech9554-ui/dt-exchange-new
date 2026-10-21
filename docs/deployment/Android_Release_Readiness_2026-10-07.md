# Android release readiness

The connected production entry point is `mobile/lib/main.dart`, not `main_preview.dart`. Public, nonsecret Dart defines are saved in `mobile/config/production.json`: official HTTPS API `/api/v1`, official download origin, update checks and version code 8002. Use build name 1.0.0 and build number 8002 together with this file. Production backend is authoritative for balances/rates; preview sample values are not release configuration.

Release command, only after signing approval and secure configuration:

```powershell
flutter build apk --release -t lib/main.dart --build-name=1.0.0 --build-number=8002 --dart-define-from-file=config/production.json
```

Signing requires an external keystore and in-memory `DT_ANDROID_KEYSTORE`, `DT_ANDROID_STORE_PASSWORD`, `DT_ANDROID_KEY_ALIAS`, `DT_ANDROID_KEY_PASSWORD`. No production identity is configured in this session. The standard Android directory contains a debug keystore only. Do not create a new production identity until explicitly approved; do not publish any debug or unsigned output.

After approval, use the existing release verification pipeline (`scripts/build-manual-apk.sh`, `scripts/attest-apk.mjs`). Verify the actual APK signer fingerprint, non-debuggable manifest, application ID `com.dtexchange.dt_exchange`, and version. Hash final signed bytes, then generate `.sha256` and signed release metadata with a separate external Ed25519 attestation identity. Do not fabricate a hash before the final artifact exists. Retain keys outside source control and supply secrets through a private local prompt.

Production connectivity evidence: prior controlled live DV Connect registration/OTP succeeded; saved authenticated test result is PROFILE_WALLET_BANKS_OK_NO_OTP. Current unauthenticated profile, wallet and bank-account requests all return 401, confirming HTTPS reachability and authentication enforcement. These are not physical-device acceptance tests. No SMS or financial action is performed for release preparation. A fresh authenticated mobile run requires the existing test credentials in a secure prompt or device after signing.

Download page currently returns 200, official APK path returns 404, active release rows = 0, and no APK download link is advertised. Keep this state until a verified signed artifact and trusted release metadata are available. Existing standard-operations admin must not be elevated to publish a release.

Admin validation: login 200, secure HttpOnly/SameSite=Strict cookie, logout 201. Orders, deposits and reviews read 200. Dashboard/users/banks/manual deposits/reconciliation/audit/system health read 403 as required by the unchanged operations grants.

Production role mapping, inspected from database:

| Modules | Existing additional role | Extra privileges to consider |
| --- | --- | --- |
| Dashboard, reconciliation read | financial-monitor | Read-only financial monitoring; no payout execution |
| Users, bank accounts | account-operator | Also grants users.manage |
| Audit logs, system health | system-operator | Also grants settings.write |
| Reconciliation review/resolution | reconciliation-operator | Also grants reconciliation.resolve |

For read-only access to all six requested modules, prefer an explicitly approved narrowly scoped role containing dashboard.read, users.read, banks.read, reconciliation.read, audit.read and system.monitor rather than assigning broader management roles. No role or grant was changed during this work. Manual deposits require DEPOSIT_REVIEW, a separate permission outside current operations scope.

Validation completed: flutter analyze reported no issues; all 333 Flutter tests passed with production API/download Dart defines. Production JSON parsed and exact approved endpoints/version validated. Signing, final APK hash and physical-device release acceptance remain pending signing approval.

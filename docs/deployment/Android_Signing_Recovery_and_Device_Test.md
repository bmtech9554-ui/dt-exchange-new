# Android signing recovery and device acceptance

Public download remains disabled until the owner explicitly confirms physical-device acceptance. Signing approval is not publication approval. No debug APK may be uploaded.

## Signing identity custody

The dedicated production PKCS12 keystore is held outside the project in the owner's `.dtexchange-signing/production` directory. Windows ACLs restrict it to the owner and SYSTEM. Passwords are entered in a private terminal, passed only through the signing process environment, and never written to configuration. Debug signing is separate. The local identity record contains the alias and must remain outside Git along with the keystore.

Keep the unique signing password in a trusted password manager. Future updates to `com.dtexchange.dt_exchange` must retain this signing identity. Do not regenerate or overwrite the keystore when a build fails. The interactive helper reuses an existing complete identity and stops on partial state.

## Recovery plan — no recovery transfer performed

1. After successful signature verification, create two independent encrypted offline backups of the PKCS12 keystore and its private identity record, using approved removable media or a separately encrypted recovery vault. Do not use the repository, public website or VPS application directory.
2. Store the password separately from the backup media, preferably in a password manager with an independently recoverable emergency-access plan. Do not place an exported password file beside the keystore.
3. Record the application ID, certificate SHA-256 fingerprint, keystore format and creation date in the recovery inventory. Fingerprints/public certificates are not private keys; aliases remain in the private inventory.
4. Verify backup file checksums privately. Restore a backup to an isolated protected temporary directory and enter the password in a private terminal. Export only its public certificate and compare its SHA-256 to the verified APK signer. Do not test by publishing or replacing the production app.
5. Preserve at least one offline copy separately from this laptop, with controlled owner access. Repeat the recovery check periodically and before replacing this computer. Do not delete the original or backups until recovery is proven.

Copying recovery material requires a destination selected and approved by the owner. No backup copy or off-server transfer is implied by this plan. Until an independent restore check is completed, off-device signing-key recovery is pending.

## Signed APK validation

Build the connected `lib/main.dart` entry point with `config/production.json`, version 1.0.0 / code 8002. Verify with Android SDK `apksigner`, compare its certificate fingerprint to the dedicated production certificate, and confirm `debuggable=false`, correct application ID and version. Generate SHA-256 only from final signed APK bytes. The sibling `.verification.json` is local validation evidence, not a signed public release attestation or publication approval.

## Physical-device acceptance

Connect the intended Android phone by USB and authorize USB debugging. Inspect installed package/signing state before installation. If a preview/debug install has the same package ID with a different signature, do not uninstall it automatically: uninstalling clears local app data and requires owner approval. Preserve any necessary data first.

Install only the verified signed release APK. Confirm production branding/navigation and the configured HTTPS API. Use the existing synthetic test account. Validate login, session persistence, Home, Wallet, Bank Accounts, History and Profile. Validate OTP with one explicitly approved controlled request to the owner's test number; do not resend automatically or capture OTP values in screenshots/logs. No real deposits, sell orders, bank payouts or ledger credits should be created.

Confirm manual-deposit and manual-payout mode remain enabled and automatic blockchain credit/automatic payout remain disabled. Keep the existing STANDARD OPERATIONS admin and permissions unchanged.

Record device/Android version, app version, pass/fail outcomes and any errors without secrets. Only after the owner explicitly confirms the device test passed may the public download/active-release metadata be enabled. Before publication, prepare and verify the existing release-attestation metadata workflow; do not treat the unsigned local verification JSON as trusted update metadata.

## Signed release artifact verified

Version 1.0.0, build 8002; application ID com.dtexchange.dt_exchange. Final APK: mobile/build/app/outputs/flutter-apk/app-release.apk, 59,203,204 bytes. SHA-256: ef26a12bdb43219c672b40667b761bdfa2559f266665ba258fd24f8a5fa9f7c8. Public signing certificate SHA-256: 475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c.

Independent Android SDK apksigner verification passed and certificate fingerprint matches the newly created dedicated production identity. apkanalyzer independently confirms debuggable=false, application ID and version. Every included libapp.so contains https://api.dtexchange.app/api/v1. Final-byte SHA-256 matches the saved sidecar. Keystore/alias inventory remains outside the project; file ACLs restrict access to owner and SYSTEM. Alias is absent from source and redacted build diagnostics. Password is not persisted by the helper. No Git metadata exists in this checkout, so historical commits cannot be audited; no Git commit was performed.

Public HTTPS checks: download page 200 without APK link; public APK path 404. No upload or publication occurred. Fresh SSH inspection timed out; financial settings were not modified by signing and retain their previously verified manual-only configuration. No admin/role changes or financial transactions. No Android device connected at validation time.

Required device acceptance before publication: installation, launch, login/register, one explicitly approved DV Connect OTP receipt/verification, Home, Wallet, Bank Accounts, Manual Deposit, TxID field/submission, proof selection/upload, Sell USDT flow, History, Profile and production API connectivity. Use only synthetic records with no real transfers or ledger credit; do not enable financial feature gates merely to pass the test. If production safely rejects a synthetic transaction due to disabled gates, record that limitation and validate write behavior in an isolated test environment. Never send another SMS automatically. Final owner confirmation is required before enabling download.

Next installation option: transfer the verified APK by USB file transfer to the phone's Downloads folder, open it with the file manager and allow installation from that source only when prompted. If an existing preview app has a different signature, stop and review before uninstalling, which would erase app-local data. USB-debugging/ADB installation can alternatively be performed after the owner connects and authorizes the device.

# Android website distribution

Target: **DTExchange.apk**, universal signed release APK. Source version `1.0.0`, build `8002`. Current build/signing status: **ANDROID_SIGNING_PENDING / native build NOT_VALIDATED**. No distributable APK exists in this delivery.

Prerequisites: Android SDK, Java/Flutter toolchain, `apksigner`, `apkanalyzer`, externally supplied release keystore and passwords, expected release certificate SHA-256, external Ed25519 attestation key, owned official HTTPS origin and production API URL. Keep all signing files outside the checkout.

From the repository root, after securely injecting variables documented in the signing guide:

```bash
bash scripts/build-manual-apk.sh
```

This runs clean, dependencies, analysis, tests and `flutter build apk --release`. It passes HTTPS API URL, version code, official update origin and enabled update checks. It then verifies signature, non-debuggable manifest, application ID, version and certificate before producing:

- `release/artifacts/DTExchange.apk`
- `release/artifacts/DTExchange.apk.sha256`
- `release/artifacts/DTExchange.apk.release.json`

The checksum and metadata are generated only from final signed bytes. Do not modify the APK afterward. Universal APK is the default; split-per-ABI artifacts may be separately built but are not a substitute for the universal website download.

Package/application ID remains `com.dtexchange.dt_exchange`; confirm organizational ownership before first public release and never change it for updates. Approved icon/splash and secure storage remain unchanged.

Do not distribute debug, unsigned, placeholder-domain or test-control builds. Play Store publishing and all iOS/App Store work are FUTURE_REQUIREMENT for this release.

# Android release readiness

DT Exchange RC1 · 1.0.0-rc.1 · Phase 8

Native release: **NOT_VALIDATED**. This environment lacks Android SDK/adb. The recorded appbundle attempt cannot produce an AAB. No keystore was supplied; no signed APK/AAB or size/hash is claimed.

Existing identity: app label DT Exchange; applicationId `com.dtexchange.dt_exchange` (ownership must be confirmed before store registration); versionName 1.0.0; versionCode 8001. Approved icons and splash remain unchanged. Release uses shrinking/R8 and no debug signing fallback. Main manifest requires internet, disables backup, and uses release network security configuration. Flutter release rejects a non-HTTPS API_BASE_URL. No new permissions were added. Biometric/push/deep-link adapters are readiness items, not activated production features.

On the authorized developer/CI machine install the pinned Flutter toolchain, Java 17 and required Android SDK/NDK/build tools; accept SDK licenses. Inject an external keystore and DT_ANDROID_KEYSTORE, DT_ANDROID_STORE_PASSWORD, DT_ANDROID_KEY_ALIAS, DT_ANDROID_KEY_PASSWORD from protected secrets. Set API_BASE_URL to the verified HTTPS staging or production API (not example.invalid).

```sh
flutter doctor -v
flutter doctor --android-licenses
bash scripts/native-release.sh android
```

The script performs clean, pub get, analyze, tests and release appbundle with version 1.0.0+8001. Expected output is `mobile/build/app/outputs/bundle/release/app-release.aab`. Record command, tool versions, warnings, size, SHA-256 and signature verification. Optionally run `flutter build apk --release --dart-define=API_BASE_URL=https://YOUR_APPROVED_HOST/api/v1` from mobile. Complete device/offline/slow-network/accessibility testing before acceptance. Never include keystore or key.properties in the source archive.

Signing and distribution workflow reference: [Flutter Android deployment](https://docs.flutter.dev/deployment/android). Confirm current Play target API requirements in the release console rather than assuming the Flutter default is sufficient.

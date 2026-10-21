# Android build and signing

DT Exchange · Final Production Setup · based on RC1 1.0.0-rc.1

**ANDROID_SIGNING_PENDING**. Native compilation: **NOT_VALIDATED** because Android SDK/adb are absent. No AAB/APK was produced and no signing key was generated.

Preserved: DT Exchange display name; approved icons/splash; application ID com.dtexchange.dt_exchange; version 1.0.0/build 8001; secure token storage; release HTTPS check; Android network security; no debug signing fallback. Confirm package ownership and intended production HTTPS API before release. Push/biometric capabilities remain readiness items until actual adapters/permissions are implemented and accepted.

On an authorized Android build machine install the pinned Flutter toolchain, Java and required Android SDK/build tools, accept licenses and inject external DT_ANDROID_KEYSTORE, DT_ANDROID_STORE_PASSWORD, DT_ANDROID_KEY_ALIAS, DT_ANDROID_KEY_PASSWORD plus API_BASE_URL. Then:

```sh
flutter doctor -v
bash scripts/native-release.sh android
```

The script runs clean/pub get/analyze/tests and appbundle release. Expected AAB: mobile/build/app/outputs/bundle/release/app-release.aab. Record size/hash, warnings, signature and device acceptance. Signing files/passwords stay outside source and archives. Do not silently generate a production key or use a debug key. Current exact build failure is retained in validation/android-build.log.

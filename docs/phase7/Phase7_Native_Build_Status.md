# Native build status

Platform: Linux x86_64. Flutter 3.47.5 / Dart 3.13.4 are available. Android SDK/adb and macOS/Xcode are not installed. Native signing keys/certificates were not supplied and are not in source.

## Android

Existing application ID `com.dtexchange.dt_exchange`, DT Exchange name, approved icon and splash are retained. Release cleartext traffic is prohibited; debug-only network policy permits local development. Backups are disabled. Release signing reads DT_ANDROID_KEYSTORE, DT_ANDROID_STORE_PASSWORD, DT_ANDROID_KEY_ALIAS and DT_ANDROID_KEY_PASSWORD. Without these inputs there is no debug signing fallback. R8/resource shrinking and plugin keep-rule readiness are configured.

On an Android SDK/JDK-equipped isolated runner:

```sh
cd mobile
flutter pub get
flutter analyze
flutter test
flutter build appbundle --release --dart-define=API_BASE_URL=https://api.example.invalid/api/v1
```

Supply the actual HTTPS API domain for release. Verify signature, package ownership, permissions, secure-storage behavior, QR, lifecycle, release R8 behavior and network errors on physical devices. No production app-store upload is configured.

## iOS

Existing bundle identifier `com.dtexchange.dtExchange` is a release ownership placeholder until the owner confirms it in the Apple account. Name/icons/splash are unchanged. ATS disallows arbitrary loads; tokens use the existing Flutter Secure Storage/Keychain implementation. No shared preferences store secrets.

On macOS with the reviewed Xcode/CocoaPods toolchain, select a registered team/profile and run `flutter build ios --release --no-codesign` for compilation, then a separately approved signed archive/IPA. Do not commit certificates, provisioning profiles or private signing identities.

Push entitlements, APNs/FCM provisioning, associated domains and device biometrics remain adapter-specific release gates. Do not enable permissions or claim push/biometric login without a real implementation and device acceptance test. Clipboard addresses remain public deposit addresses, not secrets; signed-device review must check app-switcher/screenshot exposure of private screens.

Flutter release API configuration rejects HTTP. The web JavaScript release build is distinct from native validation; secure-storage web dependencies currently produce Wasm dry-run warnings. No successful Android or iOS native build is claimed.

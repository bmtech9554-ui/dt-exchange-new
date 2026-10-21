# iOS release readiness

DT Exchange RC1 · 1.0.0-rc.1 · Phase 8

Native release: **NOT_VALIDATED**. Host is Linux; macOS, Xcode, signing identities and provisioning profiles are unavailable. No IPA, archive validation or App Store acceptance is claimed.

Existing bundle identity `com.dtexchange.dtExchange` requires Apple-team ownership confirmation. Display name remains DT Exchange; approved icons and LaunchScreen remain unchanged. Version 1.0.0 / build 8001. ATS does not allow arbitrary insecure HTTP. Existing secure-storage integration uses platform keychain; validate entitlements/access groups on the signed target. Push and biometric features remain unactivated readiness items. Add APNs entitlement and a reviewed Face ID usage description only with the actual authorized integrations; do not claim those capabilities work today.

On a Mac with supported Xcode, CocoaPods and the pinned Flutter toolchain:

```sh
flutter doctor -v
cd mobile
flutter pub get
flutter analyze
flutter test
flutter build ios --release --no-codesign --dart-define=API_BASE_URL=https://YOUR_APPROVED_HOST/api/v1
cd ..
bash scripts/native-release.sh ios
```

Set API_BASE_URL and select the approved team/profile in Xcode before the final script. The unsigned command is compilation evidence only. The script uses `flutter build ipa --release`; record archive/export paths, errors, signing team, build number, size and checksum without exposing certificates. Validate on real iPhone and supported iPad sizes, keychain persistence/logout, network failures and dynamic text. Confirm no debug or preview entrypoint is selected.

[Flutter iOS deployment](https://docs.flutter.dev/deployment/ios) provides the official archive/signing workflow. Store upload remains a separate explicitly authorized action.

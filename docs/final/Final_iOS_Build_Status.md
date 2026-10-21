# iOS build and signing

DT Exchange · Final Production Setup · based on RC1 1.0.0-rc.1

**IOS_BUILD_PENDING / NOT_VALIDATED**. Host is Linux; macOS/Xcode, Apple team and provisioning/certificates are unavailable. No IPA or signed-device validation is claimed.

Preserved: DT Exchange name, approved icon/splash, bundle ID com.dtexchange.dtExchange, version 1.0.0/build 8001, ATS HTTPS and existing secure-storage/keychain integration. Confirm bundle/team ownership and signed keychain entitlements. APNs/biometric permissions/descriptions must accompany actual reviewed integration; they are not active just because readiness is documented.

On an approved Mac:

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

Configure API_BASE_URL and the approved Xcode team/profile before the signed script. Unsigned compilation is not signed distribution acceptance. Record archive/IPA path, size/hash, warnings, signature and iPhone testing. Never include certificates, provisioning profiles or private keys in the source archive.

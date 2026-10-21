# Phase 3 connected mode

Run `flutter run --dart-define=API_BASE_URL=https://your-configured-api/api/v1` for the real Phase 3 application. See `../docs/phase3/Phase3_Implementation_Summary.md` for local setup, sandbox adapters and platform notes. The existing `main_preview.dart` remains an explicitly isolated presentation demo. No deposits or payouts are enabled.

# DT Exchange mobile — Phase 2

The complete connected mobile UI uses the unchanged Phase 1 light design, logo and component system. Flutter/Riverpod own presentation state; GoRouter owns navigation. The existing Dio and secure-storage boundaries remain for later integrations.

## Run the preview

Validated with Flutter **3.47.5** and Dart **3.13.4**. Use this SDK to reproduce the committed dependency lock. Android, iOS and web hosts are included; do not regenerate them with `--overwrite`.

```sh
flutter pub get
flutter run -t lib/main_preview.dart
```

Select an attached Android device or iOS simulator when prompted. Alternatively:

```sh
flutter run -d chrome -t lib/main_preview.dart
flutter build web -t lib/main_preview.dart --no-web-resources-cdn
```

The preview accepts sample login details and OTP **123456**. “Explore the preview” opens the sample account directly. Registration goes through OTP and account activation. State resets on logout or restart.

The normal `lib/main.dart` entry keeps mock financial screens disabled unless explicitly enabled with `--dart-define=DT_PREVIEW=true`. Neither entry connects real account or financial services in Phase 2.

## Validate

```sh
flutter analyze --no-pub
flutter test --no-pub --reporter expanded
flutter test --no-pub --dart-define=DT_CAPTURE=true test/responsive_preview_test.dart
```

The last command writes 36 actual Flutter-rendered PNGs to `../docs/phase2/previews/`. The test fonts and their licenses are under `test/assets/`; they support consistent screenshots without changing the runtime typography or theme. Preview images are widget renders at phone viewports, not screenshots of a physical iPhone/Android device.

For a headless CI environment, Flutter's supported `CI=true BOT=true` environment avoids cloud-host detection. `FLUTTER_SUPPRESS_ANALYTICS=true` disables analytics. On a filesystem that cannot restore archive owners, use `TAR_OPTIONS=--no-same-owner` during SDK artifact extraction. These are environment compatibility settings, not project security changes.

## What is implemented

All requested screens and their subflows, including the four-step sell UI, activation, notification preferences, password/reset/PIN forms, device list, local support tickets, legal preview and account-reset confirmation. Navigation is exactly Home, Wallet, History, Profile. Sell is an action inside Home/Wallet. Profile has no KYC/PAN/selfie/security menu.

In-memory preview logic uses integer amounts, immutable quote snapshots, a quote expiry, default-bank selection and replay-safe sample transitions. An explicit simulation button advances sample confirmations. “I Have Sent” cannot credit a wallet or complete a transaction. There are no API calls, valid deposit addresses, payout-provider integrations or stored credentials.

## Native validation limits

Flutter engine widget tests and the JavaScript web build run successfully in the supplied environment. The Android APK attempt stops because the Android SDK is absent. iOS builds require macOS/Xcode, unavailable here. Android/iPhone hardware, signing, native clipboard/share sheets, physical biometrics, push permissions and 60 FPS profiling remain unvalidated.

Native launcher assets are derived from the original DT SVG. Android backups are disabled and release signing does not use a debug key. Actual secure-storage/keychain and biometric configuration belongs to later authenticated integration; preview switches do not provide security. The unchanged secure-storage dependency does not support the web Wasm dry-run, so the validated web output is JavaScript/CanvasKit.

See `../docs/phase2/IMPLEMENTATION.md` and `../docs/phase2/TEST_RESULTS.md`.

**Stop after Phase 2. Continue only when instructed: “Continue Phase 3”.**

# DT Exchange preview refresh — 27 September 2026

Updated the existing Flutter app; the approved logo, design tokens, project identity, four-tab navigation, API contracts, and admin review flow are preserved.

## Changes

- Login: full-width Create account secondary button below Sign in, preserving the registration route and preview login.
- Home: mint/teal Deposit USDT and blue/navy Sell USDT cards, retaining their USDT icons, subtitles, and tap feedback.
- Rate graph: recurring lightweight sweep and endpoint pulse over the existing sample history. Motion stops for reduced motion, inactive ticker mode, and background lifecycle states. Connected mode retains its truthful decorative line.
- Deposit: amount first, dynamic estimated INR value using existing integer/BigInt money arithmetic, then TxID and proof upload. Empty/invalid amounts show a dash; unavailable rates are explicitly labeled. Estimates are not locked quotes or payouts.
- Numeric amount input accepts up to six decimal places. TxIDs retain validation and whitespace trimming before submission. Existing proof file validation, thumbnails, filename, replace/remove controls, loading states, and optional details remain available.
- Preview deposit now reuses the form below its existing QR/address section. The explicit preview submission shows a local simulation acknowledgment with no HTTP request, proof upload, or wallet credit.
- Connected wallet balance aligns its amount, canonical USDT icon, and label consistently.
- No dependency version upgrades or additional Android changes were needed. The previous file_picker Kotlin compatibility fix remains in place.

## Changed files

Application source:

- `mobile/lib/features/auth/auth_pages.dart`
- `mobile/lib/core/widgets/usdt_action_card.dart`
- `mobile/lib/core/widgets/rate_sparkline.dart`
- `mobile/lib/features/wallet/wallet_pages.dart`
- `mobile/lib/features/manual/manual_pages.dart`
- `mobile/lib/features/transactions/transaction_pages.dart`

Tests:

- `mobile/test/deposit_ux_test.dart`
- `mobile/test/preview_refresh_test.dart` (new)

Documentation/rendered artifacts:

- `docs/ui-ux-update/Preview_Refresh_2026-09-27.md` (this report)
- `docs/ui-ux-update/previews/01_Home.png` (updated)
- `docs/ui-ux-update/previews/Refresh_Login.png` (new)
- `docs/ui-ux-update/previews/Refresh_Deposit_Estimate.png` (new)

## Validation

- `flutter analyze`: no issues.
- `flutter test --reporter expanded`: 312 passed.
- Focused screenshot run: 3 passed; rendered login, Home, and deposit estimate inspected.
- `flutter build apk --debug -t lib/main_preview.dart`: successful.
- Inspected packaged Flutter kernel: contains the new preview acknowledgment, amount label, INR estimate label, and submission CTA.
- APK identity: `com.dtexchange.dt_exchange`, version `1.0.0+8002`, debug.
- APK SHA-256: `9ff96c5196e4edb4a72a79404d089dec2b273c882673cd9711441545a9265f3f`.

Exact APK path:

```text
C:\Users\Ashik\Downloads\dtexchange update\DT_Exchange_UI_Manual_Deposit_Update\dt-exchange\mobile\build\app\outputs\flutter-apk\app-debug.apk
```

This is an isolated preview test APK. Native device installation, real picker interaction on a phone, production signing, and deployment were not tested. Existing future Kotlin-plugin migration warnings remain non-blocking on the current toolchain. No production deployment or real financial transaction occurred.

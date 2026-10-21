# DT Exchange compact Home refinement

The written reference direction was used; no reference-image attachment was visible in the request.

## UI changes

- Compact mint Home rate card, ₹103.00 preview rate, PREVIEW pill, separate +0.24% and +₹0.25 (24h) sample indicators.
- Smooth chart with faint grid, translucent gradient area, highlight points, shimmer/glint, endpoint ring pulse, five time labels, and a floating rate bubble. Reduced motion and background/resume behavior remain supported. Connected mode does not render fabricated historical data, sample indicators, time labels, or sample bubble.
- Home-only compact header/spacing, smaller card padding, and better balance/action spacing. Secondary shortcuts, Quick sell, and recent transactions remain available by scrolling.
- Mint/teal Deposit and lighter blue Sell cards retain USDT icons, arrows, titles, subtitles, navigation, and tap feedback. Navy text provides contrast on the lighter blue surface.
- No changes to logo, canonical design tokens, rate authority, manual deposits, backend/admin flow, or the four bottom-navigation destinations.

## Exact changed source/test files

- `mobile/lib/features/home/home_page.dart`
- `mobile/lib/core/widgets/rate_sparkline.dart`
- `mobile/lib/core/widgets/usdt_action_card.dart`
- `mobile/lib/core/widgets/tinted_card.dart`
- `mobile/lib/core/presentation/kit.dart`
- `mobile/test/preview_refresh_test.dart`
- `mobile/test/home_layout_test.dart` (new)

Documentation: this file. Rendered artifacts under `docs/ui-ux-update/previews/`: new `Home_Compact_360x740.png`, `Home_Compact_360x800.png`, `Home_Compact_393x852.png`, and `Home_Compact_412x915.png`. The capture run also regenerated `Refresh_Login.png` and `Refresh_Deposit_Estimate.png`. Flutter build/cache artifacts are generated outputs.

## Validation

- `flutter analyze`: no issues.
- `flutter test --reporter expanded`: 325 passed.
- Main action cards fit above navigation without scrolling at 360×740, 360×800, 393×852, and 412×915 logical pixels, with 24px top and bottom system insets. These are widget viewport tests, not physical-device measurements.
- Narrow 320×700 with 1.6 text scale remains scrollable with reachable actions. Existing broader layout, navigation, API, deposit, reduced-motion, and lifecycle tests pass.
- Rendered 360×740 and 412×915 screens visually inspected.

## APK

- `flutter build apk --debug -t lib/main_preview.dart`: successful.
- Android APK signature verification: passed, v2 signature, one signer.
- SHA-256: `82bef87ac4baf1f2797718b9d1d9b4ac0af929d72e42b7f05de3198ca2dee416`.

```text
C:\Users\Ashik\Downloads\dtexchange update\DT_Exchange_UI_Manual_Deposit_Update\dt-exchange\mobile\build\app\outputs\flutter-apk\app-debug.apk
```

Ready for physical Android testing. Device installation and native-device interaction have not been performed here. No production deployment or real financial transaction occurred.

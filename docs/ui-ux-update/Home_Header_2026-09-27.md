# Home header update — 27 September 2026

Converted the user-provided WhatsApp MP4 into an infinitely looping GIF: 320 × 320, seven frames, 120 ms per frame. Preserved the original background and artwork without cropping or adding motion effects.

Home displays the approved DT logo, 12 logical pixels of spacing, and one GIF at 44–52 logical pixels, with notifications and avatar on the right. The header remains 64 logical pixels high. The text greeting/title is replaced only on Home. Existing cards, navigation, preview rate and financial flows remain unchanged.

## Files changed or added

- `.gitignore` — ignore local media conversion tooling.
- `mobile/pubspec.yaml` — register GIF asset.
- `mobile/assets/animations/usdt_single_coin_flip_live.gif` — converted animation.
- `mobile/lib/core/presentation/kit.dart` — optional custom AppPage title widget.
- `mobile/lib/features/home/home_header.dart` — responsive logo/coin header.
- `mobile/lib/features/home/home_page.dart` — use the new header.
- `mobile/test/home_header_test.dart` — GIF codec, layout and asset rendering checks.
- `mobile/test/phase3_api_test.dart` — replace obsolete greeting expectation with new header assertions; retain connected rate assertions.
- `docs/ui-ux-update/previews/Home_Single_Coin_Header.png` — rendered Home screenshot.
- This report.

## Verification

- Flutter analyze: no issues.
- Flutter test: all 330 tests passed.
- Header tested at 320, 360, 412 and 480 logical pixels wide.
- Existing above-fold and large-text Home layout tests passed.
- `flutter build apk --debug -t lib/main_preview.dart`: succeeded.
- APK signature verified; bundled GIF bytes match the validated source asset.
- Physical Android installation was not performed.
- Existing non-blocking Kotlin Gradle Plugin migration warnings remain for file_picker and share_plus.

APK: `C:\Users\Ashik\Downloads\dtexchange update\DT_Exchange_UI_Manual_Deposit_Update\dt-exchange\mobile\build\app\outputs\flutter-apk\app-debug.apk`

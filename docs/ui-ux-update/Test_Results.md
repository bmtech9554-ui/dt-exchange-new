# DT Exchange mobile UX validation

Environment: Flutter 3.47.5 / Dart 3.13.4, matching the archived release's prior Flutter validation. Locked dependencies were restored without changes. Truncated SDK files were repaired from the official Flutter distribution before final validation.

| Check | Result |
| --- | --- |
| Full Flutter regression | **309 passed** — all 288 existing tests retained, plus 21 new tests |
| Flutter static analysis | **No issues found** |
| UI/deposit tests | 21 targeted checks; final regression and screenshot capture in validation/flutter-regression.log |
| Protected source comparison | Backend, admin, ledger/schema, infrastructure, brand assets, design tokens, app navigation and Profile unchanged |
| Dependency lock | Unchanged |
| Previous tests | No existing test file modified or removed |

Commands from mobile/:

```sh
flutter pub get
flutter analyze --no-pub
flutter test --no-pub --reporter expanded
flutter test --no-pub test/deposit_ux_test.dart --dart-define=DT_UX_CAPTURE=true --reporter expanded
```

New coverage: canonical asset icon use, Home Deposit/Sell navigation, 64-character hexadecimal TRON TxID validation, exact positive amounts, paste, invalid form submission, local proof selection/removal, unsupported/empty/oversized files, authenticated upload then proof submission, submission status, unchanged wallet balance, sample-only trend data, one-shot animation, reduced motion, 320/390/430px layouts at 1.0/1.6 text scale, and submit scrolling above keyboard insets. The proof preview test also waits for actual image decode and asserts rendered pixels are available.

Financial safety evidence: the mock adapter receives only /manual/files and /manual/deposits for submission. The wallet provider balance remains identical. Backend approval/uniqueness/ledger protections are byte-for-byte unchanged, not reimplemented in Flutter.

Limitations: no backend/admin regression rerun was required for these unchanged areas; previous archived results are historical, not new runs. No physical Android/iPhone validation, signed APK build, production API connection, live transfer, or deployment was performed. Screenshots are Flutter widget-rendered previews, not photos of a physical device. Device gallery-provider behavior and haptic feel still need an on-device check.

Logs: validation/flutter-regression.log, validation/flutter-analyze.log, validation/ux-tests.log, validation/preservation.json.

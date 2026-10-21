# DT Exchange — Phase 2 test results

Validation date: 20 September 2026. Phase 2 only. All results below describe the included mobile UI preview, not production authentication or financial processing.

## Observed results

| Check | Result |
| --- | --- |
| Flutter SDK | Flutter 3.47.5 stable, Dart 3.13.4; SDK runs successfully |
| Dependency resolution | Passed; genuine generated `pubspec.lock` included |
| `flutter analyze --no-pub` | **Passed — No issues found** |
| `flutter test --no-pub --reporter expanded --dart-define=DT_CAPTURE=true` | **Passed — 160 tests, 0 failures** |
| Preview state tests | 8 passed |
| Widget flow tests | 8 passed |
| Responsive rendering tests | 144 passed: 36 screens × 4 configurations |
| `flutter build web -t lib/main_preview.dart --no-web-resources-cdn --no-pub` | **Passed — build/web generated** |
| Canonical design-token drift check | Passed |
| Phase 1 preservation check | 54 protected files unchanged by SHA-256 comparison |
| Actual UI preview images | 36 PNGs rendered by the Flutter engine at 780 × 1688 pixels |
| Android debug APK attempt | Blocked: Android SDK not installed |
| iOS build/device testing | Not run: Linux host; macOS/Xcode unavailable |

## What the tests establish

Preview state tests exercise six-decimal USDT parsing, malformed-input rejection, integer INR formatting, explicit preview gating, frozen quoted rate/beneficiary, quote expiry, balance limits, activation, one-time wallet reservation, on-chain funding, replay-safe sample completion, default-bank selection, duplicate bank rejection, notification state and logout reset.

Widget tests exercise the non-operational normal entry point; the exact four-tab navigation and restricted Profile; wrong/correct OTP with activation; the connected Amount → Confirm → Send → Track → Success flow; the guarantee that “I Have Sent” does not advance receipt or alter a balance; QR/copy consistency; activation route guards and History filters; local support tickets/read-all; and logout.

Responsive tests render and scroll every page at:

| Configuration | Logical viewport | Text scale |
| --- | --- | --- |
| iPhone-sized portrait | 390 × 844 | 1.0 |
| Android-sized portrait | 412 × 915 | 1.0 |
| Small portrait / larger text | 320 × 700 | 1.3 |
| Landscape | 844 × 390 | 1.0 |

These are Flutter widget/engine tests at representative viewports. They are not physical-device tests or iOS/Android OS emulators. Preview screenshots use the included licensed Roboto/Material icon test fonts and the application widgets; they are not independently designed mockups. Long pages are scrollable and PNGs show their initial viewport.

## Runtime validation resolution

The Phase 1 Flutter attempt encountered cloud metadata detection and was rejected by automatic approval review. Phase 2 used Flutter's documented-in-source CI detection path (`CI=true`, `BOT=true`) so that SDK startup did not perform that cloud-host metadata probe. Analytics were suppressed. Archive extraction used `TAR_OPTIONS=--no-same-owner` because this filesystem cannot restore archive owner IDs. Flutter dependency resolution, static analysis, engine tests and web compilation then ran successfully.

The earlier runtime-validation blocker is resolved for those tasks. It is not being reported as native-device certification.

## Remaining limits

- Android/iPhone installation, signing, native clipboard/share-sheet behavior, software keyboard/safe-area behavior on hardware, biometrics, keychain/secure-storage and push permissions still require native validation.
- Physical-device performance profiling is required to substantiate the 60 FPS target.
- The web build uses JavaScript/CanvasKit. Flutter's Wasm dry-run reports `dart:html`/`dart:js_util` incompatibilities in the unchanged Phase 1 `flutter_secure_storage_web` dependency. No Wasm build is claimed.
- Authentication, OTP delivery, identity/bank verification, market rates, blockchain tracking, internal ledger, real payouts and server-backed notifications/referrals/support are deliberately absent in this phase. Mock-state correctness is not backend security or financial idempotency validation.
- The backend/admin/schema were preserved; their Phase 1 validation is recorded in `docs/VALIDATION.md`, and was not represented as new Phase 2 testing.

Reproduction commands are in `mobile/README.md`. Raw logs and the preservation report are in `docs/phase2/validation/`.

**Phase 2 is complete. Phase 3 has not started.**

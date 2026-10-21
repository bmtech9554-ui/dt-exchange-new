# DT Exchange — Phase 2 implementation

Phase 2 implements the Flutter mobile interface, navigation and isolated in-memory preview. It does not enable a live financial service. Phase 3 has not started.

## Preserved foundation

The Phase 1 DT monogram, canonical palette, typography, rounded cards, gradient buttons, Flutter/Riverpod/Dio/GoRouter/secure-storage architecture, backend, database and admin foundation remain in place. Existing design and reusable widget files are not replaced. New presentation helpers compose those widgets. Native launcher icons are rasterizations of the original SVG.

The main navigation contains exactly Home, Wallet, History and Profile. Profile contains the user-details card, Bank Accounts, Referral Program, Settings and Logout, plus the requested version footer. Verification appears during activation and before financial actions.

## Connected interface

| Area | Implemented behavior |
| --- | --- |
| Splash | Original logo, white background, mint/aqua waves, timed entrance into login |
| Login / registration | Validated forms, password/OTP selection, terms links, forgot/reset-password screens, explicit preview entry |
| OTP / activation | Six-digit input, wrong-code feedback, resend countdown, success animation, onboarding activation |
| Home | Greeting, avatar, notifications, sample rate/chart, animated balances, hide/show, actions, quick sell, recent transactions |
| Wallet / deposit | USDT balance, INR equivalent, TRC20 network, QR/copy, recent deposits and sample confirmation status |
| Sell | Amount/percentages, wallet or incoming-transfer funding, bank selection, expiring quote, confirmation, send, tracking and success receipt |
| History / details | Four filters, order/type search, amounts, fees, frozen rate, bank, sample TxID/confirmations/UTR, status timeline and contextual support |
| Profile / banks | Editable sample details, restricted Profile menu, validated bank form, duplicate check, default payout selection |
| Referrals | Code/link copy, native share-sheet action, sample referral/reward metrics |
| Settings | Password, PIN, biometric and 2FA preferences, devices, notification preferences, light appearance/reduced motion, legal preview and reset/delete confirmation |
| Notifications | Unread state, read-all, transaction links and preferences |
| Support | Expandable FAQs, validated local ticket creation and ticket list |

## Preview boundary

Run `flutter run -t lib/main_preview.dart`, or opt in with `--dart-define=DT_PREVIEW=true`. The normal `main.dart` entry without that flag shows a non-operational screen and no fake financial dashboard. Every routed preview page is labelled. State is memory-only and resets on logout/restart. Forms never transmit account details, OTPs, passwords or PINs. The QR encodes an intentionally invalid, non-payment address. Referral links use the reserved example.com domain.

A share button opens the device share sheet only after a user tap. No message is sent automatically. Copy uses the device clipboard and displays animated feedback.

## Financial UI consistency

- Amounts are parsed into six-decimal BigInt USDT units. INR uses integer paise. No balance is calculated from a form display string or floating-point arithmetic.
- The sample fee is 0.50%, rounded up to a paise; gross conversion rounds down to a paise. This is an explicitly documented UI fixture, not the production rate engine.
- An accepted quote snapshots its rate and beneficiary. Later rate/default-bank changes do not modify that order.
- Repeating confirmation returns the existing sample order and does not debit twice. Quotes expire after 90 seconds.
- Wallet funding reserves the sample balance once. Incoming-transfer funding does not debit the wallet.
- “I Have Sent the USDT” navigates to tracking; it never credits a wallet or confirms receipt. Only the separate, clearly labelled simulation control advances sample provider events.
- Replaying sample completion does not duplicate payout records or notifications. These checks support interface correctness; they do not implement the backend ledger, blockchain idempotency or payout integration.

## Motion and layout

Uses the established press/transition/reveal durations, fade/slide routes, card reveal, animated rate and balance numbers, Material navigation animation, button press feedback, existing shimmer skeleton, QR reveal, animated clipboard feedback, transaction stages and drawn success check. Reduced-motion preferences are respected. Layouts use safe areas, scrollable forms, constrained widths and wrapping/flexible content.

The target is smooth native motion. A measured 60 FPS guarantee still requires physical-device profiling; widget rendering does not establish it.

## Later integration points

Phase 3 will replace the preview boundary with authenticated repositories and real verification/bank/rate services. The existing Dio and secure-storage ports are preserved. Phase 4 owns deposits, indexing, ledger and actual sell orchestration; Phase 5 owns payout providers. Biometric/2FA switches currently demonstrate interface states only, and provide no authentication protection. Native signing, keychain/biometric integration, push permissions and device-level QA remain release work.

See `TEST_RESULTS.md` for the final observed validation and `previews/` for actual Flutter-rendered screens.

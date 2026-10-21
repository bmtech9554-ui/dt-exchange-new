# Phase 5 test results

## Executed validation

| Check | Result |
|---|---|
| Backend TypeScript compile | PASS |
| Backend full suite | **91/91 PASS**: 68 prior Phase 1–4 regressions + 23 Phase 5 tests |
| SQL migration apply/replay | PASS: five migrations, including additive 005; replay unchanged |
| Flutter analyze | PASS: no issues |
| Flutter full suite | **230/230 PASS**: 214 prior tests + 16 Phase 5 responsive/API tests |
| Phase 5 Flutter render/capture suite | 16/16 PASS; four actual mobile PNG captures |
| Flutter web release build | PASS; JavaScript/CanvasKit output |
| Next.js production build | PASS |
| Design-token drift check | PASS |
| Protected source checksums | **21/21 unchanged** |
| Android APK build | BLOCKED: Android SDK not installed |
| iOS native build | Not available in Linux environment; Xcode/signing absent |
| Live PostgreSQL/Redis worker concurrency | Not executed; no server/Redis/Docker binaries available |
| Admin Chromium browser capture | BLOCKED: browser not installed; download failed with gateway/network errors |

Tools: Node.js 24.19.0, Flutter 3.47.5, Dart 3.13.4, Next.js 16.3.5. Backend tests execute actual NestJS controllers/guards/services and PostgreSQL SQL through PGlite. They are not stubs of the financial service.

## Phase 5 backend coverage

- Eligible payout creation, permanent order dedupe, encrypted immutable beneficiary terms, API masking/ownership and single active attempt constraint.
- Unfunded order, frozen user, disabled bank, bank cooldown, risk flags and configured amount limits.
- Submission without automatic success/UTR; repeated submission cannot create another provider request.
- Signed success webhook, duplicate webhook, changed replay body, invalid signature and expired timestamp.
- Provider-confirmed success, exact locked-paise ledger settlement, UTR storage, order completion and notifications.
- Definitive failure, signed failure webhook, safe retry with new attempt, immutable prior attempt and unsafe retry rejection.
- Reversal webhook, exactly one reversing journal, preserved history, review state and balanced currency journals.
- Unknown timeout, accepted-then-response-lost recovery by polling with no second attempt, and explicit transient non-acceptance retry.
- Polling fallback, reconciliation mismatch without silent financial repair, wrong provider amount and missing UTR rejection.
- Truthy string failure flags and numeric rather than string money input rejected.
- Treasury permission checks, denied retry without permission, audit event, manual review and absence of a manual-success endpoint.
- Blockchain reorg after payout preserves settlement and raises exposure review.
- Provider balance capability reporting and production mock rejection.

## Flutter coverage and previews

New tests use the existing app/router/components with sandbox API fixtures at iPhone 390×844, Android 412×915, small 320×700 with 1.3 text scale and landscape 844×390. Tests cover payout processing, successful transaction, payout details and actual payout history. Scrolling checks catch overflow across the full page. Processing has no fabricated UTR; success/details show only fixture provider values labelled SANDBOX.

PNG previews are actual Flutter engine renders. The admin preview is static HTML rendered from the real React payout component and existing CSS, with labelled sandbox fixtures and disabled controls. Browser interaction/screenshot validation was not possible, so that HTML is not presented as a browser screenshot.

## Security review findings addressed

- Raw-body signature verification, timestamp bounds, event-ID/hash replay protection and strict provider result types.
- User/order/payout transaction locks; unique aggregate/attempt/provider keys; submission claim before external side effect; uncertain outcomes never authorize a new transfer.
- Journal settlement/reversal idempotency; SQL order completion guard; exact decimal/paise strings.
- Recheck account/bank/risk/funding/limits before submission; immutable encrypted bank snapshot.
- Provider status contradictions and chain reorg exposure create review issues, retaining history.
- Separate admin sessions, live role checks, reason-required mutations, audited review/retry/note/refresh and no manual-success route.
- Environment-only secrets, no source private keys or embedded production credentials; safe provider error handling and masked API bank data.

These are implementation checks, not an independent security certification. Multi-process race/crash tests with real PostgreSQL/Redis, deployment permissions, chosen provider acceptance, funding reconciliation and native device builds remain release gates.

## Known build warnings and limitations

The successful Flutter web build reports existing WebAssembly dry-run incompatibilities in `flutter_secure_storage_web` (`dart:html` / JS interop). The JS/CanvasKit build succeeds; a Wasm build was not claimed. Android remains blocked by the missing SDK. No live TRON funds, production payout credentials, real UTR or real INR transfer was used.

The source archive includes successful validation logs under `docs/phase5/validation`. Initial development failures were fixed; failed intermediate runs are not the final result. Browser-download and Android limitation logs are retained separately.

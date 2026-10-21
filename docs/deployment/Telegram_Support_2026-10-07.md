# Public Telegram support update

Official public contact: DT Exchange Support, @dtexchange, https://t.me/dtexchange.

## Implemented
- Shared mobile Telegram support card in preview and backend-connected Help & Support.
- Connected support card remains outside ticket API loading/error state.
- Android external HTTPS handler uses Telegram or a browser; failures show a friendly message.
- Public website support section and footer use accessible links with noopener/noreferrer.
- No Telegram credentials, bot, backend integration, financial settings or RBAC changes.
- Preserved production graph lifecycle fix; prepared version 1.0.0, build 8006.

## Verified
- Flutter analyze: no issues.
- Flutter tests: 343 passed.
- Focused backend rate/deposit tests: 5 passed.
- Website tests: 39 passed.
- Website production build passed.
- Website-only deployment completed over strict verified SSH, with previous source/image retained for rollback.
- Live website HTTPS 200; exactly two safe Telegram external anchors.
- Public APK endpoint remains 404 (disabled).
- Samsung ADB authorized.

## Pending
- Physical support-link navigation, Home graph animation and lifecycle, remaining screen checks on Build 8006.
- Browser visual inspection unavailable this run because Computer Use runtime failed to initialize.

No public APK publication is authorized. Financial automation remains disabled. No real transactions were performed.

## Release verification and installation
- Build 8006 signed successfully using the existing production certificate.
- apksigner verification passed; debuggable=false; production API configured.
- SHA-256: 9f8f7f899d88de10d5923ab5749360f5801ad2cee6efe374c5d1e829e314c7fb
- Copied to C:\Users\Ashik\Downloads\DTExchange-release.apk; copied hash matches.
- Samsung adb install -r succeeded; package reports versionCode 8006.
- No uninstall, data clearing, or public publication.
- User unlocked Samsung; existing authenticated session preserved after update.

## Physical results on Build 8006
- Home displays production INR 103.00 and labels the graph as decorative.
- Graph-region images differ at 0/1.2/30/60/61.2 seconds; highlight remains active.
- Graph-region images differ after tab return and after background/resume.
- Wallet, History, Profile, Bank Accounts, Deposit, and Help & Support opened.
- Telegram Support and @dtexchange visible; tapping launches installed org.telegram.messenger.
- Telegram remains Connecting and does not resolve the target contact. Correct-account physical confirmation is BLOCKED, not passed. No messages were read or sent; only public navigation/header labels inspected.
- Existing account review banner is visible on Home. Deposit submission remains paused with synthetic exception disabled. No account/financial controls were changed.
- Browser visual inspection remains unverified because browser runtime failed; live HTML anchors/HTTPS checked successfully.
- No full physical validation or publication readiness claim is made. Public download stays disabled.

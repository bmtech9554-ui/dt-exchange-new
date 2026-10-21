# Build 8007: Telegram opening and accurate release restriction

## Diagnosis
Production read-only inspection of the dedicated test account found active status, verified mobile, no unresolved high/critical risk flags, and active sessions. Legacy verification remains required but is not the manual-mode eligibility condition. No account fields were changed.

Home refresh automatically requests a quote when a bank exists. The production Android release guard denies writes because no published release exists and temporary synthetic validation is disabled. It throws Update Required. The generic HTTP filter mislabeled all 403 responses as account verification/review. This was inaccurate error classification, not stale credentials or a stale eligibility cache. Other production execution gates also remain disabled.

Telegram public HTTPS page returns 200, title DT Exchange, deep link tg://resolve?domain=dtexchange. Direct Android deep-link launch succeeds independently of DT Exchange. Previously Telegram showed Connecting; this run it displayed its own authentication flow. Network/login completion is external to DT Exchange and is not inferable from launcher success. No Telegram credentials or codes read/entered, and no messages sent.

## Changes
- Public Telegram deep link attempted first; public HTTPS fallback on false/exception/timeout.
- Each launch wait bounded to 3 seconds; app remains responsive and button is restored.
- Backend release denials remain HTTP 403, with fixed ANDROID_RELEASE_REQUIRED code and accurate approved-release message.
- No auth guard, financial policy, RBAC, database migration or account state changes.
- Version 1.0.0+8007 prepared using existing signing identity only.

## Checks
- Flutter analyze: no issues.
- Flutter tests: 345 passed.
- Backend tests: 207 passed, including release guard rejection and synthetic safety.
- Encrypted production backup completed; response-filter-only API deployment completed.
- API readiness 200; API/web/PostgreSQL/Redis healthy.
- Manual deposit review and manual payout true; automatic credit/payout false; transactions/payouts false; Android release enforcement true.
- Website links unchanged; public APK URL 404.

## Pending
Secure existing signing password entry, Build 8007 signature/hash/update installation and final physical checks. No publication authorized.

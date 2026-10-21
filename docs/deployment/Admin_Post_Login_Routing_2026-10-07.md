# Admin post-login routing fix

Root cause: the root route opens Dashboard, which correctly requires permissions absent from the existing administrator. The old component conflated authentication with successful Dashboard loading, so a successful login followed by 403 left the login form visible.

Production state inspected read-only: one active admin; password credential and TOTP enrollment present; NTP synchronized; successful login audit and active session observed. Existing roles are operations, manual-deposit-approver and android-release-publisher. The exact seven permissions remain ANDROID_RELEASE_PUBLISH, DEPOSIT_APPROVE, DEPOSIT_REVIEW, deposits.read, orders.read, reviews.acknowledge and reviews.read. No grants, credentials, database or backend changes.

Implementation: shared authenticated shell and TOTP login form; server-side session access discovery through existing guarded read-only endpoints, discarding record bodies and returning only available module names. Login success is separate from module authorization. Preferred landing is /manual-deposits. Unauthorized navigation is hidden; direct unauthorized URLs show a permission-denied state with a link to permitted operations. Session expiry and logout clear the shell state. Reviews now has an explicit route using the existing guarded reviews endpoint. Backend guards remain authoritative for every action.

Changed files:
- admin/src/lib/admin-access.ts (new)
- admin/src/lib/navigation.ts
- admin/src/app/api/operations/[...path]/route.ts
- admin/src/app/[module]/page.tsx
- admin/src/components/admin-session.tsx (new)
- admin/src/components/admin-shell.tsx
- admin/src/components/production-operations.tsx
- admin/src/components/manual-operations.tsx
- admin/src/components/operations.tsx
- admin/src/components/engagement-operations.tsx
- admin/src/components/payout-operations.tsx
- admin/test/admin-access.test.tsx (new)

Validation: 45 admin tests pass, TypeScript check and production build pass. Isolated browser verifies rejected login, valid login/TOTP form flow, permitted redirect, hidden restricted navigation, authenticated Dashboard denial, return link, logout, subsequent login and expiry. Existing React checklist reviewed: bounded independent fetches, cleanup of session listeners, stale request guard, no client token storage, explicit labels, shared gate and server-side authorization preserved.

Only web service rebuilt/restarted, with source and image rollback retained. Public admin HTTPS and anonymous session401 verified; API/database/Redis/worker readiness healthy. Published Build8009 download remains unchanged and correct at mobile/desktop widths. No APK rebuild, signing, publication, financial transaction or SMS occurred.

## Live validation completed

ADMIN_PANEL_LOGIN_UX_FIXED

Secure headless production browser validation completed with the existing password and two fresh user-entered authenticator codes. Both logins returned HTTP200, landed at /manual-deposits and hid the login form. Secure/HttpOnly/SameSite=Strict cookie and restricted API cookie path verified in memory. Dashboard direct navigation displayed permission denial and an allowed return link, without sign-in UI. Logout returned the shell to sign-in; session endpoint401 confirmed revocation; subsequent login and final logout passed.

HTTP200 modules: Manual Deposit Reviews, Android Releases, USDT Deposits, Sell Orders and Reviews. HTTP403: Dashboard, Users, Bank Accounts, Reconciliation, Audit Logs, System Health. Other unavailable navigation is hidden according to guarded endpoint results; no additional grants.

Synthetic proof permission/decryption checked via the unchanged ManualService.file method for the existing administrator, with required manual.file_read audit. No proof contents printed. This was a service-level proof validation, not a new HTTP proof test. No review approval/rejection or financial action performed.

Manual review/payout true and both automatic financial execution flags false verified. API health remains ready. User input stayed in terminal/process memory; no password, TOTP code, token or cookie was persisted in reports. The helper's initial pre-login stop was diagnosed without account mutations; the reopened prompt completed validation. No further blocker remains for this admin UX fix.

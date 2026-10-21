# Manual policy deployment and build 8004 — 2026-10-07

## Implemented and deployed
- Approved customer rate is stored in PostgreSQL: MANUAL_ADMIN, INR 103.00 per USDT; margin/spread 0, fixed fee 0, service fee 0, quote lifetime 60 seconds.
- Sell minimum remains 100 USDT; maximum is now 5,000 USDT. Daily and monthly SELL caps remain unapproved/unconfigured (NULL). NULL is NOT unlimited for sells: LimitsService rejects quote eligibility until both caps are configured.
- Manual deposit policy is stored in system_settings and editable through permission-gated, versioned, audited admin settings: minimum 100 USDT; daily 20,000 USDT; monthlyDepositLimit=null and monthlyLimitEnabled=false; depositFeeUsdt=0.
- Deposit daily boundaries use Asia/Kolkata, consistent with existing sell limits. Pending/review/credited requests reserve usage by submission day; rejected/cancelled requests do not. A resubmission rechecks and reserves the current day. User-row locks serialize concurrent submissions and approvals.
- New migration 011 adds policy snapshots, daily accounting date, and a separate net_credited_amount. Approved net credit equals verified amount. Existing credited records are not rewritten. Existing complete blockchain evidence, exact submitted/confirmed matching, duplicate protections, immutable audit/ledger and RBAC remain enforced.
- Deposit form displays backend-provided minimum/daily rules and no monthly cap. A paused form permits local input checks but cannot submit. No deposit fee or net-after-fee UI.
- Bank add/save and sell confirmation show: Withdrawals are processed within 24 hours. Ensure your bank details are correct.
- Website terms fetch database-backed values through /api/v1/app/terms; no stale static rate fallback. Website and app settings contain: We process only reviewed transactions that meet our compliance requirements.
- No admin-role grants, automated credit/payout enablement, SMS requests, real transfers, or public APK publication were performed.

## Verification
- Backend: 199/199 tests passed. Additional deposit-settings RBAC/version/audit/monthly-cap assertions passed in the targeted integration test.
- Admin: 38/38 tests passed; backend/admin TypeScript checks passed.
- Flutter analyze: no issues. Flutter: 335/335 tests passed with production defines.
- Encrypted pre-migration backup created and checksum verified. Official migration runner applied 011; earlier migrations untouched.
- Production readiness HTTP 200 after update. Website, admin, download page and public terms HTTP 200. Public terms returns rate 103.00000000, deposit 100/20000/null and sell max 5000. Authenticated rate endpoint correctly returns 401 without a session.
- Confirmed runtime flags: MANUAL_DEPOSIT_REVIEW=true, MANUAL_PAYOUT=true, AUTOMATED_BLOCKCHAIN_CREDIT=false, AUTOMATED_PAYOUT=false, TRANSACTIONS_ENABLED=false. Financial execution remains paused.
- Public APK URL remains HTTP 404; no active release was published.

## Signed release
- Version 1.0.0; build 8004; production API https://api.dtexchange.app/api/v1.
- Existing signing identity reused; v2 signature verified; debuggable=false.
- Certificate SHA-256: 475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c
- APK SHA-256: eabd7e157e179464e9114d0b54966c7e5b05b0865cd3d59e4d9f81ec6a04ae4c
- Size: 59,219,588 bytes.
- Copy: C:\Users\Ashik\Downloads\DTExchange-release.apk. Copy hash verified.
- Installed on connected Samsung as adb install -r after comparing the existing signer. No uninstall or data clearing; app launched.

## Physical-device checks
Passed: installation/launch; user completed sign-in on phone; Wallet, History, Profile, Bank Accounts and Deposit pages open; official TRC20 address visible; Copy address success feedback; 99 USDT shows required minimum error; 100 USDT clears that error; minimum/daily/unlimited-monthly labels; no deposit-fee labels; withdrawal note on bank form.
QR address payload/wrapping/copy exactness is covered by Flutter tests. Daily reservations, no monthly cap, duplicate TxID, manual review/credit, payout integrity and 5,000 sell maximum are covered by isolated synthetic backend tests, NOT by production financial transactions.

## Unresolved blockers — do not publish
1. Physical Home still displays UNAVAILABLE / INR 0.00 even though public database terms return 103.00. Exact authenticated rate-read failure is not diagnosed yet.
2. SSH became unreachable from the laptop (port 22 timeout on repeated strict-host-checked attempts). HTTPS remains reachable. Browser recovery tooling failed to start. Restore the working network path before server-log/rate-service diagnosis; no key reinstall or host-verification bypass is needed.
3. Daily and monthly SELL caps require explicit owner approval; no existing safe production values were present. The separate deposit policy has NO monthly cap.
4. Physical proof-picker/upload, review-state and complete sell flow have not been certified on this build. Submission/execution gates remain paused. Public download requires explicit owner approval only after remaining physical validation passes.

Signing recovery plan remains docs/deployment/Android_Signing_Recovery_and_Device_Test.md. No signing secret or recovery material is included here.

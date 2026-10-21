# Build 8004 scoped synthetic physical validation - 7 October 2026

Status: requested remaining mobile submission/quote checks passed. Overall acceptance remains incomplete because the existing STANDARD OPERATIONS admin cannot access the manual-deposit review endpoint. Do not report unconditional full validation or publish the APK.

## Approved backend deployment
- Encrypted production backup created and checksum verified through the existing migration runner.
- Additive migration 013_synthetic_validation_safeguards.sql applied. Existing migrations/data retained.
- API only rebuilt/restarted; readiness HTTP 200.
- Additional owner-approved release-guard fix deployed: only the dedicated account, approved Build 8004 and expiring scope can perform synthetic deposit/quote writes without a public active Android release. Orders are excluded. Normal authentication/session/version checks remain.
- No Flutter changes, APK rebuild, signing change, reinstall, OTP or real transfer.

## Physical Samsung results
- Build 8004 retained, existing login session preserved.
- Synthetic 100-USDT submission succeeded and phone displayed UNDER REVIEW.
- Backend confirms exactly one dedicated test deposit, permanent synthetic marker, no verified amount and no credit. Uploaded private PNG hash exactly matches local fixture: bdeb0d5092822531c5e954305a2d1ed927d5060424848fb51ff15565ca894650.
- A new form/request key with the same synthetic TxID was rejected with conflict; no second deposit created.
- Add Bank Account UI created TEST SYNTHETIC NON-PAYOUT using dummy format-valid details. Bank remains UNDER_REVIEW, provider synthetic-nonpayable, nonPayable=true. Permanent database guards prohibit verification, real orders and payouts.
- 250 USDT quote shows INR 25,750.00 at rate 103, fee 0. Database TTL exactly 60 seconds.
- Phone displayed quote-expired message and replaced Confirm Sell with Refresh quote. No order confirmation was pressed.
- 5,001 USDT rejected by quote validation; exactly 5,000 USDT quoted INR 515,000.00 with zero fee. Database confirmed the result and expiry.
- Physical screenshot QR decoded successfully: TReyJ2Amq4GhmrwdCuVwLPtpQCk1SUhBmn, exactly matching the approved visible address. TRON/TRC20 labels confirmed. Copy/minimum/daily/monthly/fee checks already passed and were not repeated unnecessarily.

## Remaining admin acceptance blocker
- Existing operations role has deposits.read for the legacy blockchain-deposit endpoint but lacks DEPOSIT_REVIEW used by /admin/manual/deposits.
- That existing admin therefore cannot see the synthetic manual-review record through its authorized endpoint. No admin role/grant was modified and no authorization was bypassed.
- Resolve with an explicitly approved read-only manual-review access design; do not grant credit/payout permissions merely for visibility. Authenticated admin UI visibility remains unvalidated.

## Final safety and tests
- 32 focused backend tests passed; backend compiled. Flutter unchanged; previously passed physical/widget checks retained.
- Synthetic validation scope explicitly disabled and audited after tests. Permanent synthetic safeguards remain active.
- Global transactions and payouts remain disabled; both manual modes true; automatic blockchain credit and payout false.
- Final counts: ledger journals 0, dedicated test orders 0, dedicated test payouts 0, active Android releases 0.
- Public APK endpoint HTTP 404. Public publication remains disabled.
- Removed only the synthetic PNG placed in phone Downloads and reopened the app to clear cached test configuration. Original app data/session retained.

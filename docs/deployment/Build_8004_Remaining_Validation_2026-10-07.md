# Build 8004 remaining validation — 7 October 2026

Status: PARTIAL. Public APK publication is not technically ready for approval.

## Completed in this validation run
- Connected authorized Samsung reports production package version 1.0.0, build 8004. No APK rebuild, reinstall, migration or OTP request was performed.
- Existing authenticated session used. Wallet, History, Profile, Bank Accounts, Deposit and Sell opened.
- Home retains backend-sourced 103.00; production policy is MANUAL_ADMIN.
- Public TRC20 address matches TReyJ2Amq4GhmrwdCuVwLPtpQCk1SUhBmn. QR semantics are present, and copy reports success. Exact QR payload/address and clipboard behavior pass focused Flutter tests; no new screenshot-decoder certification is claimed.
- Phone amount input rejects 99 and accepts 100; 100 estimates INR 10,300.00. No deposit fee label. Backend-provided daily limit and no-monthly-cap labels displayed.
- Invalid TxID is rejected; a synthetic 64-character hash passes format validation. No deposit request was submitted.
- Android proof picker opens; synthetic PNG selects with filename, selected indicator, Replace and Remove controls. Removal succeeds. Synthetic file created for this run was deleted from the phone; no other files changed.
- Exact withdrawal note is visible in Add Bank Account. App settings and website show the approved compliance wording.
- Production readiness, website and public terms return HTTP 200. Public APK endpoint returns HTTP 404.
- Database confirms deposit minimum 100, daily 20000, monthly null with limiting disabled, fee 0; sell minimum 100, max 5000, daily 20000, monthly 100000, expiry 60 seconds.
- 30 focused backend synthetic tests passed, including proof handling, duplicate TxID, manual review/credit, policy and limits. 27 focused Flutter tests passed, including QR/address, deposit UX and authenticated rate parsing. These are isolated tests, not production financial executions.

## Remaining physical-test blockers
- TRANSACTIONS_ENABLED=false deliberately pauses production deposit submission. Therefore actual phone-to-server proof upload/submission, duplicate request rejection and manual review-state progression were not exercised on production. Local selection is not equivalent to server upload.
- The test account has no bank account. Sell opens and offers Add bank account, but an on-phone quote and its 60-second expiry cannot be validated with that account. The backend policy and isolated calculations are verified.
- No safeguards were changed to force a pass. Full physical validation must not be reported as passed on the basis of isolated tests alone.

## Safety state after testing
MANUAL_DEPOSIT_REVIEW=true; MANUAL_PAYOUT=true; AUTOMATED_BLOCKCHAIN_CREDIT=false; AUTOMATED_PAYOUT=false; TRANSACTIONS_ENABLED=false.
Production counts: ledger journals 0; manual deposit requests 0; active Android releases 0.
No real USDT or INR transaction, publication, new signing identity or production account change.
Public download remains disabled and requires explicit owner publication approval after remaining validation.

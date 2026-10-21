# Build 8007 final physical validation - 7 October 2026

## Release and device
Signed production Build 8007 installed on authorized Samsung RZCX715MH5J with adb install -r. No uninstall or data clearing; session retained. Existing signing certificate independently verified on copied APK. No rebuild/resign during this validation.
APK: C:\Users\Ashik\Downloads\DTExchange-release.apk
SHA-256: cbc6fda0ed519c5c49493ec891267392d06866f0e7334d0149a798b88e0f99f1

## Physical checks
- Home INR 103.00 from backend; no inaccurate account-review message.
- Graph region changes through 60+ seconds, after navigation, and after background/resume. Decorative labeling retained.
- Wallet, History, Profile, Bank Accounts and Support opened.
- Exact bank-account note and compliance sentence verified on device.
- Deposit displayed exact public TRC20 address; screenshot QR decoded to TReyJ2Amq4GhmrwdCuVwLPtpQCk1SUhBmn. Copy action exercised.
- 99 USDT rejected; 100 USDT accepted by local validation and estimated as INR 10,300.
- Invalid TxID rejected with 64-character requirement; cleared before synthetic submission.
- Clearly labeled synthetic PNG selected and uploaded from physical device.
- Synthetic 100-USDT deposit submitted and displayed Under Review; database confirms UNDER_REVIEW, synthetic=true, proof attached, no credit and review history exists.
- Fresh form with identical synthetic TxID rejected as conflict; database has no duplicate TxID rows.
- Existing permanently non-payable synthetic bank selected in Sell.
- 250-USDT quote created: rate 103, fee zero, net INR 25,750; database confirms synthetic bank and 60-second policy.
- 5,001-USDT request rejected after selecting synthetic bank.
- Valid quote observed until expiration; action became Refresh quote, with expired explanation. No Confirm Sell/order request performed.
- Production deposit policy verified read-only: minimum100, fee0, daily20000, monthlyLimitEnabled=false/monthlyDepositLimit=null.
- Production sell policy verified read-only: maximum5000, daily20000, monthly100000, expiry60, no fees/spread.

## Reviewer validation evidence
Existing authenticated manual-reviewer acceptance remains valid from the earlier completed secure test: login/TOTP, private proof, manual deposits HTTP200, synthetic review audit, unrelated access denials and logout. No new admin login was performed here. Current permission assignment verified unchanged; new synthetic record has review history and remains available for manual review. No permissions changed and no deposit approved.

## Telegram
Visible Telegram Support / @dtexchange; tapping hands off to installed Telegram and returning leaves DT Exchange responsive. Tested launcher uses exact tg://resolve?domain=dtexchange first and HTTPS fallback; false/exception/timeout coverage passed. Public HTTPS page returns200 with exact official deep link. Telegram did not expose the expected destination header during physical observation; earlier direct launch showed connection/authentication problems. Classified EXTERNAL TELEGRAM ISSUE under owner's instruction; final in-Telegram destination rendering is not claimed verified. No messages/credentials/OTP actions.

## Scoped production window closed
Owner explicitly approved dedicated existing account + Build8007, maximum60minutes. Five permanent synthetic safeguards checked before enabling; enable/disable audited. Immediately after synthetic tests, enabled=false and expiresAt set to closure time. Normal release enforcement confirmed by phone returning the accurate approved-release-required message.
Final checks: ledger journals0, orders0, payouts0, active Android releases0. Manual deposit/payout true; automated credit/payout false; global transactions/payouts false; Android update enforcement true. Public APK URL404.

## Result
DT Exchange-controlled validation passed, using current physical checks plus unchanged prior authenticated reviewer acceptance. External Telegram destination rendering remains unconfirmed. Public APK publication requires separate explicit approval.

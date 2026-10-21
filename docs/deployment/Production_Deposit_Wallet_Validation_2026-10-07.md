# Production deposit-wallet validation — 2026-10-07

Configured owner-supplied TRC20 USDT address: TReyJ2Amq4GhmrwdCuVwLPtpQCk1SUhBmn. TRON Base58Check validation passed. No ownership or blockchain confirmation was fabricated and no funds were sent.

The backend stores the address in versioned system_settings/manual_deposit_wallet. Initial owner-authorized configuration was recorded once as a service audit event after an encrypted backup. New admin settings GET/POST routes require settings.read/settings.write, exact-address confirmation, reason, checksum validation and optimistic version checks. Concurrent changes serialize using an advisory transaction lock. Existing STANDARD OPERATIONS has no extra role assignment and cannot edit these settings.

Manual configuration reads no longer depend on automatic-chain provider configuration. Approval still requires the existing genuine evidence/security checks. Mobile receives exact address/network/asset plus depositsEnabled=false and sandbox=false. Submissions remain paused. Address display, QR, clipboard feedback and narrow layout have automated coverage. Production QR accessibility no longer calls the address a preview. Network-loss warning updated; paused-deposit message added. No invented fee/minimum was introduced.

React form review: existing component library retained, labeled inputs, explicit confirmation and reason, busy state, backend authorization/version protection, no financial-control change. No new heavy dependencies or effect-driven writes.

Validation:
- Backend: 195 passing, including synthetic manual proof validation/access control, duplicate TxID, review/rejection, approval-only ledger credit and manual payout regression tests. Synthetic blockchain evidence exists only in isolated tests, never production.
- Admin: 37 passing; TypeScript and production image builds passed.
- Flutter: analysis clean; 334 tests passed with production defines. Updated fixture timing/version endpoint handling for the enabled update gate. Preview no longer calls production update checks.
- API readiness: 200. Deployed configuration read returns exact approved address and correct mainnet/TRC20/USDT values.
- Unauthenticated private proof GET: 401. Unauthenticated admin wallet setting GET: 401.
- Download page: 200. Public APK: 404.
- Manual review/payout=true; automated blockchain credit/payout=false; transactions enabled=false.

Physical device: connected Samsung release 8002 launches successfully; current screen is Sign in. No credentials, OTP, tokens or screenshots of sensitive screens captured. Authenticated Home/Wallet/History/Profile/banks/sell/deposit/proof submission/navigation/session persistence still require local sign-in and device testing. No new OTP sent. Prior live OTP/authentication results do not replace this pending device acceptance.

Remaining gates:
1. Enter the EXISTING Android production signing password in the private terminal to build version 1.0.0 / code 8003 with the same identity. No signing rotation or public publication authorized.
2. Verify the new APK certificate/hash and perform device tests. Installed build 8002 does not contain the latest Flutter changes.
3. Sign in on the phone; obtain explicit approval before any new live SMS. Do not populate production with fake chain evidence or credits. Financial feature gates remain paused; write-flow verification is currently isolated synthetic testing only.
4. STANDARD OPERATIONS remains unable to review manual deposits. Do not expand its permissions automatically.
5. Public APK publication remains blocked pending explicit physical-device acceptance. Signing-key independent recovery backup/restore remains pending per documented plan.

Build 8003 signed with the same production certificate, copied to Downloads and SHA-256 verified: 9b825aec4bfb997ff4ff1eae04b08daea2d7f2b7337fe447c67007a2b51cf44d. ADB verified the installed build 8002 signer matches; install -r succeeded without uninstall or app-data clear; package now reports 8003 and activity launch Status ok. UI automation blocked by device keyguard showing=true; owner unlock/sign-in requested. Authenticated UI/OTP/address/copy/QR/submission checks are not yet certified. No SMS or financial action performed. Public download stays disabled.

Build 8003 physical check after owner unlocked phone: authenticated Home/header/bottom navigation visible; Home shows Service temporarily unavailable. Production inspection confirms zero rate_policies and zero fees, while API readiness remains 200. RatesService.policy therefore rejects USDT/INR reads with Rate policy not configured (503); mobile loadAccount awaits this before loading wallet/history. No rate, fee or limit was invented. Physical acceptance remains blocked pending approved production rate/fee/limit configuration. No OTP, financial transaction, role change or publication performed.

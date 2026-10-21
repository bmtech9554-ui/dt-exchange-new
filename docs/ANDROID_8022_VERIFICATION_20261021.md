# Build 8022 Samsung verification — 21 October 2026

Core financial simulation: PASS. Overall release verification: INCOMPLETE.
Existing signed APK retained; no rebuild or publication.
Only the isolated test API and non-payable demo bank were used.

## Observed on Samsung

- Fresh test registration and login: PASS (user 1013).
- Deposit request for 100 demo USDT: PASS.
- Manual Demo Admin deposit approval: PASS; deposit CREDITED.
- Wallet: PASS; available 100 USDT, reserved 0, pending INR 0 after approval.
- Sell quote: PASS; 100 USDT at INR 103, zero fee, net INR 10,300.
- Sell submission: PASS; order c9fa20a4-de61-411d-bec0-4b41d9f313cb,
  wallet-funded and now completed.
- Admin Sell approval: PASS after owner reauthentication; PROCESSING observed.
- Simulated payout: PASS; Demo Admin SUCCESS and Samsung Transaction Successful,
  INR 10,300, no real transfer.
- Recorded demo UTR: SIMULATED-SIMULATED-8022-USER1013 (the simulation
  service adds its own prefix to the entered reference).
- Transaction history: PASS; credited deposit 100 USDT, completed sell 100 USDT,
  successful INR payout 10,300 visible on Samsung.
- Receipt download: PASS in both admin browser and Samsung Downloads.
  SHA-256 matches the uploaded synthetic PDF:
  1681c2a76047b609668dbe6b2cd97a1d227a4a9d254e4d004897f1ea91ef28e7.
- Biometric: owner reported completing the prompt; app returned through splash
  to authenticated Home. User-assisted observation, not independent biometric
  success-event instrumentation.
- Light/Dark: both selections verified. System Default restored and verified
  during the next continuation.
- Home graph: explicitly decorative while historical prices are unavailable.
- Telegram handoff: PASS. The actual support button launched
  org.telegram.messenger/org.telegram.ui.LaunchActivity. No conversation was
  inspected and no message was sent.
- Coin animation: PASS after USB reconnection. Unevenly timed Samsung
  screenshots show distinct coin rotation frames within the observed Home
  coin bounds (217,295)-(344,421). The initial evenly timed captures sampled
  the same phase of the 840 ms looping GIF; they were insufficient alone.
  Evidence: .audit/local-android/8022-coin-motion-evidence.png and original
  8022-motion-1.png through 8022-motion-3.png. A four-second Home recording
  is also saved as .audit/local-android/8022-home-animation.mp4.

Deposit ID: b8d196b9-e63f-4c36-abdf-62a8959dc423.
Do not alter unrelated demo users or restore previously frozen accounts.

## Source corrections (not in installed Build 8022)

Deposit detail now refreshes the authoritative wallet after CREDITED.
Wallet snapshots also update the shared balance used by Home and Sell.
Sell loads current wallet/banks/configuration and selects wallet funding in
manual deposit mode. Returning from Add Bank refreshes the quote.
No balance is inferred from a submitted deposit or credited optimistically.
No financial/security gate changed.

## Validation

- Backend compilation and complete tests: 320 passed.
- Admin tests: 60 passed. Initial sandbox execution failed in Node user-info
  lookup; authorized execution outside the sandbox passed.
- Flutter complete suite: 407 passed.
- Additional Sell refresh regression plus manual UI suite: 21 passed.
- Flutter static analysis: no issues.
- Existing real PostgreSQL/Redis suite was not rerun in this continuation;
  earlier evidence remains in .audit/production-transition-integration.log.

Logs: .audit/android-verification-{backend,admin,flutter,analyze}.log and
.audit/android-wallet-regression.log.

The deposit-to-payout financial simulation and listed Build 8022 UI checks
pass, with the biometric observation qualification above. This does not
establish production readiness or a real historical-price graph.
Source corrections require a separately prepared later APK
and physical retesting. No production balances, accounts, VPS settings,
public APK or real transfers were modified.

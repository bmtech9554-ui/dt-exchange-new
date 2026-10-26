# Admin-controlled manual financial operations — implementation contract

Status: design and acceptance gates only. **Not enabled for real money.**

## Deposits
- A single admin-configured TRC20 receiving address is displayed to all users. Address versions remain immutable on submitted requests.
- User submits TXID, amount and proof; this creates a PENDING request with **zero balance change**.
- Authorized admin explicitly starts review, independently verifies the transaction using trustworthy evidence, and chooses approve, reject, or request more information.
- The requested operating model does **not** call a backend blockchain RPC during approval. Removing RPC verification requires an approved replacement attestation workflow; proof screenshots alone are not sufficient evidence.
- Before approval, atomically reject reused TXIDs, mismatched destination/amount, unverified custody, and duplicate credits. Record reviewer, evidence references, timestamp, rate-policy snapshot, reason and audit event.
- Credit the **INR ledger** once, using the approved immutable USDT/INR rate snapshot, not a floating rate. Do not also credit a spendable USDT balance unless separately authorized and reconciled.

## Withdrawals
- User submits one INR withdrawal with 1–50 owned/eligible bank accounts and positive paise allocations whose sum exactly equals the requested amount.
- Reserve the requested INR **once** on submission; admin may approve, reject, or hold. No payout provider may automatically send money.
- For each approved leg, admin transfers money outside the application, then uploads a private receipt and UTR and confirms that exact bank and amount. Persist each leg's status independently.
- Overall COMPLETED is permitted only when every leg is confirmed and the amounts reconcile. Any ambiguous or failed leg remains under review; never automatically refund money already sent.
- Rejections before transfer release only the appropriate reserved liability through an audited, idempotent ledger reversal.
- Keep bank account data encrypted and masked; restrict beneficiary reveal and financial actions to privileged MFA-protected admin roles.

## Required implementation blockers
1. Existing `ManualService.review` requires `verifyDepositOnChain` and credits a USDT wallet ledger. Replace with separately reviewed manual attestation and INR-only posting; do not simply bypass checks.
2. Existing `ManualService.process` creates one payout per order; implement split allocations and per-leg settlement without weakening existing lifecycle guards.
3. Integrate the split validator and allocation schema with user/admin endpoints, UI, receipts, and exact-sum reconciliation.
4. Resolve migrations 024/025 across open PRs and test clean + upgrade migrations.
5. Verify unique TXIDs, immutable rate snapshots, idempotent approval/settlement, role enforcement, receipt authorization, failed/retry scenarios, and concurrency.
6. Keep financial activation flags off until KYC/custody, reconciliation, audit, and operational acceptance are complete.

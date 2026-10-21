# Required operating model: manual deposits and manual INR payouts

Owner clarification, 20 October 2026: all deposit approvals and payout execution
are manual. Automatic blockchain credit, automatic bank transfers and an automated
bank payout provider are outside the requested release scope.

## Deposit

1. Customer submits the USDT amount, TRC20 transaction hash and private proof.
2. The request enters review without increasing the wallet balance.
3. An authorized admin independently checks the transfer, recipient, token,
   amount and confirmations and records the verification evidence.
4. On real networks, the read-only TRON reader corroborates that evidence.
   This is verification only: it neither signs transfers nor approves requests.
5. Admin approval credits the persistent ledger once. Rejecting a request does
   not credit it. Duplicate claims and repeat approval cannot duplicate credit.

## Sell and payout

1. Customer accepts a backend quote and selects an eligible bank account.
2. The backend reserves available USDT atomically, enforcing the configured rate
   and limits. Published production terms currently specify 103 INR/USDT and
   maximum sell 5,000 USDT.
3. An authorized admin reviews the request and starts manual payout processing.
4. The authorized operator makes the actual bank transfer outside DT Exchange.
   DT Exchange does not initiate a bank transfer.
5. Admin records the actual UTR, exact amount, payment time, bank used and genuine
   private payment evidence, then confirms verified settlement.
6. The backend posts settlement once and updates history and receipt access.
   Uncertain payments remain under review. A refund requires evidence that no
   transfer occurred; it must not be used to resolve an uncertain transfer.

## Controls retained

Keep `MANUAL_DEPOSIT_REVIEW=true`, `MANUAL_PAYOUT=true`,
`AUTOMATED_BLOCKCHAIN_CREDIT=false` and `AUTOMATED_PAYOUT=false`.
Production transaction/payout activation remains separately gated; this clarification
does not authorize changing deployed settings or moving customer funds.

Keep authentication/MFA, financial permissions, customer/bank verification,
risk checks, limits, immutable audit records, private evidence and ledger safeguards.
Manual operation does not establish operating approval or make evidence genuine
merely because it was uploaded.

The software already implements this manual lifecycle. Do not add an automatic
payout vendor merely to satisfy the earlier broad production-transition checklist.
Identity/risk and bank-verification acceptance remain separate from whether
deposit approval and payout execution are manual.

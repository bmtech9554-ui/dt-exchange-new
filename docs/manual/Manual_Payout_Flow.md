# Manual INR payout

1. User accepts a server-calculated quote against approved available USDT. The existing ledger reserves/debits USDT and records the fee and INR liability. Insufficient balance rejects order creation; no frontend amount is trusted.
2. A `PAYOUT_VIEW` admin sees masked bank data and locked INR payable. `PAYOUT_PROCESS` starts processing with a reason and IMPS/NEFT/RTGS selection. The server validates active verified user, risk flags, verified owned bank, new-bank cooling period, funded wallet order, sell journal, payout amount and platform daily limits.
3. Starting creates one manual payout with an encrypted beneficiary snapshot. The full beneficiary is revealed only to an authorized processing admin, and the reveal is audited. Starting does not send money or complete the order.
4. Admin checks the business bank and performs the transfer outside DT Exchange. Before retrying anything, check whether the bank accepted the original transfer.
5. “Mark Payment Sent” requires exact INR, UTR/reference, paid date/time, business bank used, note and a private JPG/PNG/PDF receipt. The confirmer uploads their own receipt. If transfer outcome is uncertain, use manual-review escalation and do not send again.
6. `PAYOUT_CONFIRM` locks the user/order/payout, verifies the evidence and amount, posts the existing INR settlement journal, marks payout SUCCESS and order COMPLETED, and appends PAID/COMPLETED manual history, audit and notifications in one transaction.
7. The user sees the actual recorded UTR, payment time and authenticated receipt in transaction detail. Test fixtures are clearly sandbox-labelled; there is no fabricated production bank reference.

Unique payout-per-order, unique manual UTR, unique receipt-per-payout, immutable completion evidence and `payout:<payoutId>` journal idempotency prevent duplicate completion. A repeat with the same UTR/receipt returns the existing result. Conflicting confirmation cannot change historical payment evidence.

Manual review preserves the INR liability. There is no automatic retry, balance refund, fabricated bank failure or manual reversal shortcut. A discovered reversal/dispute must follow the existing audited financial investigation and compensating-entry policy; never edit a successful payment or initiate a second transfer without independently resolving the first.

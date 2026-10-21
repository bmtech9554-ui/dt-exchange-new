# Ledger integrity report

DT Exchange RC1 · 1.0.0-rc.1 · Phase 8

Local fixture audit: **PASS**, subject to the final regression log. Live staging/production ledger: **NOT_VALIDATED** because no database connection was supplied.

RC1 lifecycle creates five journals: deposit, USDT reservation, sale conversion, fee and INR payout settlement. The read-only integrity SQL returns no fixture issues. Existing regression tests additionally cover reversals, referral rewards, journal immutability, balanced entries, unique event keys, quote usage and failed/unknown payout outcomes. Monetary values use exact decimal/integer representations; no calculation changes were made.

Run against an approved database using a read-only credential:

```sh
node backend/scripts/ledger-audit.mjs
```

Inject DATABASE_URL securely. The command opens REPEATABLE READ READ ONLY, evaluates `backend/operations/ledger-integrity.sql`, and exits 2 on issues or 1 when unavailable. It checks balanced journals, successful payout settlement presence/amount, completed order state and reversal journals. Never accept a connection error as a clean audit.

Reconciliation also compares provider status/reference/amount with internal payout state. Missing/ambiguous records require review; no automatic correction of an uncertain financial outcome. No live provider reconciliation was performed. Before release, reconcile blockchain deposits, orders, pending liabilities, settlements, UTRs, fees, reversals and referral rewards against the same snapshot and approved provider statements. Inventory any adjustment journals and their authorization; a balanced journal alone does not prove the underlying business event is valid.

Any imbalance, duplicate financial effect, missing settlement or critical provider mismatch blocks release. Freeze new financial activity, preserve evidence and follow the ledger incident runbook. Do not edit historical entries or reset balances.

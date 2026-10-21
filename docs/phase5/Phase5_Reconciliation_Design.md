# Phase 5 reconciliation design

Reconciliation compares internal payouts/attempts, provider status, immutable ledger journals and sell order state. It reports evidence; it does not silently fix ambiguous money discrepancies.

## Inputs and scheduling

The BullMQ reconciliation job runs every five minutes, selects up to 1000 payouts ordered by last reconciliation time, and uses the configured adapter's status lookup. A dedicated `last_reconciled_at` keeps scheduling separate from status polling. If the adapter supports provider inventory, records without internal attempts produce MISSING_INTERNAL issues. Balance monitoring is optional and runs on this schedule when supported.

The mock is durable in `sandbox_payout_records`. This is an isolated simulated provider data store, not a banking statement. It does not imply real provider availability, balance or funding.

## Checks

| Evidence | Result |
|---|---|
| Missing status record for a submitted attempt | MISSING_PROVIDER |
| Provider inventory/webhook with no internal attempt | MISSING_INTERNAL |
| Provider amount differs from immutable payout amount | AMOUNT_MISMATCH |
| Provider reference differs from recorded attempt | REFERENCE_MISMATCH |
| Provider status differs from internal lifecycle | STATUS_MISMATCH |
| Returned UTR differs from stored UTR | UTR_MISMATCH |
| Internal success without settlement or completed order | LEDGER_ORDER_MISMATCH |
| Reversed payout without reversal journal/review order | REVERSAL_LEDGER_MISMATCH |
| Blockchain reorg after payout submission/success | CHAIN_REORG_PAYOUT_EXPOSURE |
| Conflicting provider result after terminal failure/success | TERMINAL_STATUS_CONFLICT |

Duplicate internal aggregates, active attempts, success attempts, provider references and journals are prevented with unique constraints. Provider-side duplicate transfers outside a trustworthy adapter's inventory require vendor statement/incident reconciliation; database uniqueness alone cannot prove that an external bank never sent twice.

Successful provider evidence while the internal state is pending is both detectable by reconciliation and recoverable by authenticated polling through the normal atomic settlement path. Reconciliation itself does not post a second journal or mark an order complete. All matches create audit events; discrepancies create deduplicated issue records and user risk holds where a user is known.

## Records and resolution

`reconciliation_issues` stores payout, issue type, unique dedupe key, status, sanitized comparison context, detected/resolved timestamps and resolution notes. Supported statuses are MATCHED, MISMATCH, MISSING_INTERNAL, MISSING_PROVIDER, MANUAL_REVIEW and RESOLVED. Matches are currently recorded as audit events rather than accumulating per-check issue rows.

Treasury can read issues in the existing payout dashboard. The permission-checked resolve API requires a reason and leaves financial values and risk holds unchanged. Resolution notes describe the evidence reviewed; they are not authorization to release money. Risk release, bank/provider correction or accounting adjustment needs the existing controlled administrative/accounting process. No automatic missing-record repair or manual success toggle exists.

## Reversal and exposure

A provider-confirmed reversal restores the user's pending INR liability by reversing the exact original payout journal once. The order enters manual review. Original payout attempt, UTR, timestamps and settlement remain available.

A blockchain reorg after submission does not prove that INR returned. The service preserves the payout and original accounting, records exposure and holds the order for investigation. This avoids inventing funds or deleting history. A reviewed loss/receivable journal and provider cash statement may be necessary before releasing the hold.

## Operational validation still required

- Run workers against real Redis and PostgreSQL, including concurrent dispatcher/submitter processes, process death after provider acceptance and queue loss.
- Verify the selected vendor's idempotency lifetime, definitive-failure guarantees, callback signatures, event ordering, statement pagination and reversal contract.
- Reconcile the provider clearing/payable account against actual prefunding/cash statements. The current implementation does not fabricate a provider cash balance or import an unnamed vendor's statements.
- Monitor retained failed jobs and unresolved/stale issues. Rotate environment-managed keys and apply least-privilege database roles before live deployment.

The current tests exercise real application services/controllers and SQL through PGlite plus the durable mock. They do not replace provider certification or multi-process production acceptance.

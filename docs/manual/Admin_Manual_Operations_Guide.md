# Admin guide

Use the existing admin sign-in. A security administrator must grant the appropriate manual role explicitly; migration does not promote existing support users.

| Task | Permission |
|---|---|
| Read deposits/proofs, start/reject/request information | DEPOSIT_REVIEW |
| Approve independently verified deposit | DEPOSIT_APPROVE |
| Read masked payout queue/receipt | PAYOUT_VIEW |
| Start payout and reveal beneficiary | PAYOUT_PROCESS |
| Confirm evidenced bank payment / escalate uncertainty | PAYOUT_CONFIRM |
| Publish attested Android metadata | FINANCIAL_ADMIN |

Manual Deposit Reviews: select a request, inspect private proof, open the fixed mainnet explorer link where applicable, start review, then enter every verified field under the approval details. Include a specific verification note. Approve only after checking the correct chain, token, destination, amount and confirmations. Reject/request information with a user-appropriate reason.

Manual INR Payouts: select a funded order, enter a reason and bank transfer method, then start processing. This reveals the immutable beneficiary snapshot only if your role permits it. Make the transfer externally. Never interpret a processing label as proof of bank payment. Upload the receipt, enter exact amount, UTR, payment timestamp, business bank and note, then confirm. Use manual review for an unknown/failed bank response; do not retransfer blindly.

Queues are paginated in batches of 50. Dashboard metrics include proofs pending, under review, approved/rejected today, payouts pending/processing/completed and manual-review count. Viewing combined metrics requires both deposit-review and payout-view access.

Android Releases: build/verify/sign the artifact externally, then paste the generated `.release.json` attestation. Publishing metadata does not upload an APK or deploy a website. Securely publish the matching bytes first and verify the checksum. Historical releases are retained as deprecated metadata and cannot be rewritten.

Review bank statements, chain transactions, ledger integrity and open manual-review cases every operating day. Escalate discrepancies through existing audited support/risk operations.

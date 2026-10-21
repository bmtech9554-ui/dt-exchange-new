# Manual USDT deposit review

1. User opens Wallet → Deposit USDT. The API supplies the configured shared TRC20 receiving address and confirmation target. Sandbox screens explicitly warn against sending real USDT.
2. “I Have Sent USDT” opens a proof form. Amount and TxID are mandatory. Optional fields are sender wallet, transaction date/time, screenshot/PDF and note. A valid proof submission creates `PROOF_SUBMITTED` and an in-app notification; no ledger journal is posted.
3. A `DEPOSIT_REVIEW` admin starts review, producing `UNDER_REVIEW`. Verify the transaction independently using the correct blockchain explorer or a trusted read-only node. Do not follow arbitrary user links.
4. Check successful execution, configured network and USDT contract, receiving wallet, actual amount, sender, block/hash/time and confirmation threshold. Check that the submitter is entitled to claim this shared-wallet transfer. User-entered claims and screenshots are not authoritative.
5. `DEPOSIT_APPROVE` submits all verified details and a note. Claimed and verified amount/hash/recipient must match. Mismatches are rejected for investigation, not silently rounded or credited. The service checks active verified account, operational controls, chain provisioning and prior transaction usage.
6. One SQL transaction locks the request, inserts the chain record, posts a balanced `deposit:<network>:<txHash>` journal, stores approval evidence, appends APPROVED/CREDITED history, audit and notifications. Commit is the only point at which available USDT increases.

The unique `(network_code, tx_hash)` constraint also prevents another user from claiming the same submitted hash. Existing blockchain uniqueness and ledger event uniqueness protect cross-mode processing. Repeated credited approval is idempotent. Failed validation or ledger posting rolls back the entire approval.

Review may request more information or reject with a clear reason, such as transaction not found, wrong network/token/recipient, amount mismatch, invalid proof, reused transaction or insufficient confirmations. The user may attach updated evidence to their own rejected/information-requested record. TxID, recipient and original amount stay immutable. A wrongly entered amount or disputed ownership requires support investigation; the system does not bypass duplicate protections to create a second claim.

Ledger entries and credited proof evidence cannot be edited or deleted through these APIs. Manual verification is an accountable human attestation, not automated blockchain acceptance. No actual mainnet transaction was verified during this implementation.

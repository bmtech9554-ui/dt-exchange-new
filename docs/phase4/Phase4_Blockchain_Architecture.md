# Phase 4 blockchain and accounting architecture

## Boundaries and custody

The NestJS modular monolith remains authoritative. The Flutter “I Have Sent the USDT” action performs a GET and navigates to tracking. It cannot create a chain event, set confirmations or post a journal.

`TronBlockchainProvider` exposes transaction/log retrieval, latest/canonical block data, confirmation calculation, address/contract validation and paginated incoming transfers. `MockTronProvider` is isolated to `tron-mock` and prohibited in production. `TronHttpProvider` separates indexer candidates from RPC receipt evidence. The configured official USDT contract must match the enabled database token record and use six decimals. Real contract addresses are deliberately not guessed or silently defaulted.

The read-only adapter calls the configured node for transaction execution and receipt logs, and retrieves block identity. Transfer events are decoded with Base58Check address validation and exact integer amounts. An indexer row alone cannot credit funds. RPC and indexer endpoints may be configured separately. The operator must verify they refer to the configured chain; independent node quorum/chain-identity attestation is not implemented. These interfaces follow the official [TRON receipt API](https://developers.tron.network/reference/gettransactioninfobyid) and [account TRC20 pagination API](https://developers.tron.network/reference/get-trc20-transaction-info-by-account-address).

`AddressCustodyProvider` allocates addresses using a stable allocation key. Development addresses are non-payable identifiers. The implemented gateway client requires HTTPS, bearer credentials from the environment and idempotent allocation. Its external gateway must guarantee unique, never-reused addresses and secure custody; that gateway is not bundled. No signing, sweeping or private-key storage is implemented.

There is one permanent address per user wallet/network, plus a distinct address per on-chain order. This prevents a late transfer to an old order from funding a new order. Retired/old addresses remain monitored. Shared collection-address matching is not enabled.

## Order lifecycle

| Public status | Existing database status | Meaning |
| --- | --- | --- |
| AWAITING_DEPOSIT | awaiting_funds | Quote consumed; waiting for funds |
| DEPOSIT_DETECTED | detected | Valid candidate recorded |
| BLOCKCHAIN_CONFIRMING | confirming | Confirmation policy not yet satisfied |
| DEPOSIT_CONFIRMED | funded | Deposit accepted and accounting posted |
| READY_FOR_PAYOUT | payout_pending | Net INR liability exists; no payout executed |
| MANUAL_REVIEW | review | Ambiguity or risk hold; no automatic resolution |
| EXPIRED / CANCELLED / FAILED | expired / cancelled / failed | Closed before normal funding; later evidence requires review |

The service centralizes transitions; a database trigger independently rejects illegal transitions and writes timestamped immutable history and an audit record. Phase 4 forbids progression into payout processing or completion. A future phase must explicitly extend the state guard.

Order acceptance locks the user and quote state, verifies bank ownership and eligibility, rechecks current limits excluding that same quote's reservation, allocates custody if needed, inserts the immutable order, and consumes the quote in one database transaction. Allocation uses an external stable idempotency key so a retry cannot generate an unrelated address. The bounded custody call currently occurs inside the transaction; production capacity planning must account for this lock duration.

## Detection and matching

1. A scheduled dispatcher fairly selects assigned addresses. A scan fetches one bounded indexer page for a fixed time window.
2. Every candidate hash is reread from the blockchain provider. Only the configured contract, network, assigned recipient and successful execution are eligible.
3. The worker locks the user and takes a transaction-scoped advisory lock for network/hash. Chain events remain uniquely identified by network/hash/log index.
4. An order address requires exactly one official-token transfer with exactly the quoted raw amount. Pre-assignment, late, additional, underpaid, overpaid, wrong-token/network, failed or ambiguous transfers are held for review. User verification, account, wallet and risk status are rechecked.
5. Confirmations use head minus inclusion block plus one. The effective threshold cannot drop below the stored order/deposit threshold. No ledger credit occurs before it is met.
6. Deposit, allocation, status changes and journals commit atomically. Failure rolls back all financial mutations.

USDT raw amounts are integer strings; normalized values have six effective fractional digits in the existing numeric ledger columns. Quote/rate/fee calculations use BigInt and existing PostgreSQL numeric/minor-unit fields, never floating-point money arithmetic.

## Permanent idempotency

| Boundary | Protection |
| --- | --- |
| Quote acceptance | Locked ACTIVE state; expiry check; unique order quote ID |
| Address allocation | Unique stable allocation key and network/address |
| Chain event | Unique network/hash/event index |
| Automatic financial credit | One confirmed event per network/hash; permanent `deposit:network:hash` journal key |
| Order funding | Unique deposit allocation; exact order amount; one automatic allocation |
| Financial event | Unique reserve/sell/fee journal keys by order ID |
| Reversal | Unique linked reversal journal and immutable original entries |

Multiple transfer logs sharing a hash are retained where eligible for evidence, but are not automatically split into multiple credits. Queue job IDs are an optimization; PostgreSQL owns financial deduplication. These constraints are tested with PostgreSQL WASM; separate-process contention on a PostgreSQL server remains a release validation item.

## Double-entry accounting

| Event | Debit | Credit |
| --- | --- | --- |
| Confirmed deposit, USDT | Platform custody asset | User available liability |
| Sell reservation, USDT | User available liability | User reserved liability |
| Conversion, USDT | User reserved liability | Platform FX clearing equity |
| Conversion, gross INR | Platform FX clearing equity | User pending-payout liability |
| Applied fee, INR | User pending-payout liability | Platform fee income |

Every journal balances separately per asset. The resulting user INR liability equals the accepted net quote. No INR cash balance, payout provider result or UTR is invented. Balance reads aggregate immutable ledger entries. Reversals append opposite entries linked to originals.

A confirmed deposit whose canonical evidence changes is reversed and placed under review. For a general wallet-deposit reorg, unpaid wallet-funded sales are conservatively unwound before reversing the lost credit. Missing receipts produce an account/order review hold rather than assuming success. The conservative high-severity review policy also blocks new quotes for the affected account until authorized reconciliation resolves the risk flags. Acknowledgement alone does not clear that hold. No automatic re-credit follows a reversal. Manual financial reconciliation and any already-executed payout recovery belong to later authorized work.

## Workers, failures and monitoring

`backend/src/blockchain-worker.ts` runs a separate BullMQ process with four-way concurrency. Jobs cover scan dispatch, per-address scans, confirmation dispatch/deposit matching, order expiry and stale confirmation review. Five attempts use exponential backoff. Failed jobs remain in Redis and are recorded in `worker_failures`; Redis/DB failure logging omits provider response bodies and secrets.

Database cursors persist the fixed window/fingerprint only after its candidates are handled. Completed scans restart from address assignment to catch late-indexed transfers. This favors correctness and is bounded per page, but costs additional provider requests for old, busy wallet addresses. Production sizing, retention and indexer backfill policy require load validation. Time-bucket job IDs coalesce dispatch duplicates; overlapping/retried jobs are still safe at the database boundary. See the [BullMQ scheduler](https://docs.bullmq.io/guide/job-schedulers/) and [job ID behavior](https://docs.bullmq.io/guide/jobs/job-ids).

Audit records capture status changes, deposit credits and review acknowledgements. Structured inspection/job/failure logs contain identifiers and safe codes, not private keys, OTPs, bank account numbers or provider credentials. Operators must monitor retained failures, cursor age, old pending orders and the review queue; runtime metrics transport/alert routing remains a deployment integration.

## Admin security and unresolved production validation

Admin tokens are separate 256-bit opaque, hashed, 15-minute sessions. Mobile JWTs cannot access admin routes. Permissions are read from the database on every request. Production login requires TOTP enrollment, rejects reused time steps, and uses the existing encrypted secret storage. The TOTP vector check follows [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238). The Next.js proxy stores only an HttpOnly, same-site cookie and verifies POST Origin. Acknowledgement requires permission and a reason, writes an audit event, and cannot resolve financial holds or edit blockchain values.

No webhook is exposed in Phase 4, so no unsigned webhook can credit funds. Live RPC/custody behavior, Redis job recovery under process loss, PostgreSQL concurrency, key management, backups, least-privilege deployment roles and native mobile builds still require their external infrastructure. No live-chain or real-money test was performed.

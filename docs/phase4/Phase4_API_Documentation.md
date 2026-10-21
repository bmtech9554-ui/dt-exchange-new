# Phase 4 API additions

Base path: `/api/v1`. User endpoints require the existing mobile bearer access token. JSON monetary values are decimal/integer strings. Existing Phase 3 auth, verification, bank, rate, quote and session APIs are retained.

## Orders and quotes

`POST /sell/quote` additionally accepts optional `fundingSource: "onchain" | "wallet"` (default onchain). The existing server calculation and bank selection remain authoritative. Quote responses include `fundingSource` and configuration-derived `executionEnabled`.

### POST /sell/orders

Requires a fresh `Idempotency-Key` (16–128 accepted characters) and:

```json
{
  "quoteId": "<owned-active-quote-uuid>",
  "bankAccountId": "<the-bank-uuid-on-that-quote>"
}
```

The chosen bank must match the quote. Change the bank by requesting another quote. The server checks current account/verification/risk status, bank status, expiry, single use and current limits. Wallet funding additionally checks the active wallet and ledger availability.

Response: HTTP 201 with the same object shape as order GET. An identical idempotency replay returns the stored original response; GET the order for current status. A different body with the same key returns 409. A used/expired quote returns 400; another user's or unknown quote returns 404; ineligible accounts return 403. Transactions disabled or custody not configured returns 503. No frontend amount/rate/fee/INR field is accepted.

### GET /sell/orders/:id

Owned orders only; unauthorized ownership returns 404.

```json
{
  "orderId": "<uuid>",
  "orderNumber": "DT-<reference>",
  "quoteId": "<uuid>",
  "status": "READY_FOR_PAYOUT",
  "amountUsdt": "100.000000000000000000",
  "exchangeRate": "92.45000000",
  "feeInrMinor": "4623",
  "finalInrMinor": "919877",
  "bankAccountId": "<uuid>",
  "fundingSource": "onchain",
  "depositAddress": "<custody-assigned-address>",
  "qrPayload": "<same-address>",
  "network": "TRC20",
  "chainNetwork": "tron-mock",
  "txHash": "<64-lowercase-hex-hash-or-null>",
  "confirmations": 20,
  "requiredConfirmations": 20,
  "createdAt": "<ISO-8601>",
  "updatedAt": "<ISO-8601>",
  "expiresAt": "<ISO-8601-funding-deadline>",
  "timeline": [{"status": "AWAITING_DEPOSIT", "at": "<ISO-8601>"}],
  "sandbox": true,
  "payoutExecuted": false
}
```

This example is illustrative, not a real transfer. Wallet-funded orders have no deposit address and can reach READY_FOR_PAYOUT atomically from their existing available balance. Complete status history is returned. No bank number, internal risk metadata, provider credential or private key is exposed.

There is no “mark paid” endpoint. The sent button simply calls this GET. Flutter polls at eight-second intervals while pending, pauses in background and stops at ready-for-payout/review/terminal states. Manual refresh remains available.

## Wallet and history

| Method / path | Result |
| --- | --- |
| GET `/wallet` | `availableUsdt`, `reservedUsdt`, `pendingInr`, `source: "ledger"`, `sandbox` |
| POST `/wallet/deposit-address` | Stable verified-user wallet address, QR payload, TRC20/network identity, required confirmations and sandbox indicator; empty body |
| GET `/history` | Paginated owned deposits, orders and payouts; no fabricated payout records |
| GET `/history/:id` | Owned deposit details, or order detail with `type: "sell"` |

Wallet address allocation is idempotent through its permanent allocation key. A reused order address is never assigned to a later order.

History query parameters:

- `type=all|deposits|sell|payouts`, default all.
- `status=<database-status>` optional, e.g. `confirming`, `credited`, `payout_pending`, `review`.
- `page=1` and `limit=20`; limit is 1–100.

Response: `{items, page, limit, total, hasMore}`. Items contain `id`, `type`, `amount_usdt`, `inr_minor`, `status`, `created_at`. Ordering is descending time then ID. Deposit detail includes TxID, address, block and confirmation progress. Offset pagination may shift when new records arrive; it does not affect financial correctness. An empty page reports zero total because the window count has no row.

## Operations admin

Admin endpoints use their own opaque bearer session, not mobile JWTs. The Next.js `/api/operations/*` proxy handles the browser session cookie. Tokens never enter browser local storage.

| Method / path | Permission / behavior |
| --- | --- |
| POST `/admin/login` | `{email,password,code?}`; rate-limited; returns 15-minute session. TOTP required in production |
| POST `/admin/logout` | Revokes current admin session |
| GET `/admin/orders?page=1` | `orders.read`; 50 records, rate/fee/liability/address/status |
| GET `/admin/orders/:id` | `orders.read`; detailed timeline and blockchain progress |
| GET `/admin/deposits?page=1` | `deposits.read`; user/order, address, hash, block, amount and confirmations |
| GET `/admin/reviews?page=1` | `reviews.read`; unresolved risk flags |
| POST `/admin/reviews/:id/acknowledge` | `reviews.acknowledge`; `{reason: "10–500 characters"}`; records reviewer and audit reason |

Acknowledgement returns `{success:true, financialValuesChanged:false}`. It does not release a risk hold, resolve a reorg, credit a deposit or execute a payout. Confirmed blockchain fields have no editing endpoint.

## Configuration and provider contract

New `.env.example` fields: `TRANSACTIONS_ENABLED`, `TRON_PROVIDER`, `TRON_NETWORK`, `TRON_API_URL`, `TRON_INDEXER_URL`, `TRON_API_KEY`, `TRON_USDT_CONTRACT`, `TRON_REQUIRED_CONFIRMATIONS`, `BLOCKCHAIN_SCAN_INTERVAL` (milliseconds), `ORDER_DEPOSIT_EXPIRY_SECONDS`, `CHAIN_STALE_REVIEW_SECONDS`, `TRON_MOCK_FIXTURE_FILE`, `CUSTODY_PROVIDER`, `CUSTODY_API_URL`, `CUSTODY_PROVIDER_API_KEY`, and server-only `DT_BACKEND_URL`.

The legacy reserved `TRADING_ENABLED`, `DEPOSITS_ENABLED` and `PAYOUTS_ENABLED` flags stay false. Phase 4 is gated explicitly by `TRANSACTIONS_ENABLED`; payout execution has no implementation. `GET /health/live` reports Phase 4 and payout-disabled state; readiness requires migration 004.

The external custody gateway contract is `POST /v1/deposit-addresses`, authenticated by environment-provided bearer token and stable Idempotency-Key. Input: `{userId, allocationKey, purpose, network, asset:"USDT"}`. Output: `{address, reference, network, asset:"USDT"}`. Real-network responses must pass Base58Check and ownership/uniqueness persistence checks. The gateway must never return private keys.

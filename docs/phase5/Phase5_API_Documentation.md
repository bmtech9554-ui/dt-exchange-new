# Phase 5 API documentation

Base `/api/v1`. Existing Phase 1–4 endpoints remain available. Monetary values are decimal/integer **strings**. Normal user APIs require the existing JWT/session authentication and ownership. Admin APIs require separate admin sessions and live treasury permissions.

## User endpoints

| Method | Path | Result |
|---|---|---|
| GET | `/sell/orders/:id` | Existing order/chain/timeline plus payout summary, completedAt, payoutsEnabled |
| GET | `/payouts/:id` | Owned payout, lifecycle, masked bank, rail, INR minor amount, UTR/reference, timestamps, history, sandbox |
| GET | `/history` | Existing paginated deposits/sell/payout history |
| GET | `/history/:id` | Owned order, deposit or payout details |
| GET | `/transactions` | Alias of history list |
| GET | `/transactions/:id` | Alias of history detail |
| GET | `/notifications` | Latest 100 owned in-app notifications including payout events |

History accepts `type=all|deposits|sell|payouts`, optional lowercase `status`, `page` and `limit` (1–100). Payout list history uses lowercase normalized lifecycle; detailed payout APIs use uppercase lifecycle. Order statuses preserve the existing Phase 4 mapping.

Order payout summary:

```json
{
  "status": "COMPLETED",
  "payoutsEnabled": true,
  "payoutExecuted": false,
  "payout": {
    "id": "<payout-uuid>",
    "status": "SUCCESS",
    "utr": "SANDBOX-UTR-EXAMPLE",
    "payoutReference": "SANDBOX-<provider-reference>",
    "completedAt": "2026-09-20T12:04:30.000Z",
    "sandbox": true
  }
}
```

`payoutExecuted` means a non-sandbox confirmed success; it stays false for a successful sandbox scenario. Flutter uses normalized state for the labelled sandbox preview and never represents it as a real bank transfer. No UTR is returned until supplied by provider evidence.

There is intentionally no public “send INR” or “mark success” endpoint. The background worker discovers eligible READY_FOR_PAYOUT orders and invokes the internal payout service. Its default rail is IMPS; the service supports an explicit supported IMPS/NEFT/RTGS rail. Provider capabilities and limits are checked.

## Admin endpoints

| Method | Path | Permission |
|---|---|---|
| GET | `/admin/payouts?status=PROCESSING&page=1` | payouts.read |
| GET | `/admin/payouts/:id` | payouts.read |
| POST | `/admin/payouts/:id/retry` | payouts.retry |
| POST | `/admin/payouts/:id/review` | payouts.review |
| POST | `/admin/payouts/:id/refresh` | payouts.refresh |
| POST | `/admin/payouts/:id/note` | payouts.review |
| GET | `/admin/reconciliation` | payouts.read |
| POST | `/admin/reconciliation/:id/resolve` | payouts.review |
| GET | `/admin/payout-provider/balance` | payouts.read |

Actions require `{ "reason": "10–500 character explanation" }`. Lists return at most 50 payouts per page; reconciliation returns the latest 100 issue records. Detail includes attempt history. Bank numbers remain masked. A retry returns `{ "queued": true }`; unsafe retry returns 409. Reconciliation resolution changes the issue record only, returns `financialValuesChanged:false` and `riskHoldReleased:false`, and creates an audit event.

The Next.js BFF allowlists routes, keeps the admin token in an HttpOnly cookie, rejects cross-origin POSTs and disables response caching. There is no manual success route. Permissions are granted to the treasury role only by the explicit Phase 5 seed, not to all existing operators.

## Webhook endpoint

`POST /webhooks/payout/:provider` is authenticated with the adapter's signature, not a mobile JWT. The current registered provider is `mock`.

Headers:

- `Content-Type: application/json`
- `X-Payout-Timestamp: <10-digit Unix seconds>`
- `X-Payout-Signature: <lowercase hex HMAC-SHA256>`

Body:

```json
{
  "eventId": "unique-provider-event-id",
  "result": {
    "requestKey": "<order-uuid>:payout:1",
    "reference": "SANDBOX-provider-reference",
    "amountMinor": "919877",
    "status": "SUCCESS",
    "utr": "SANDBOX-UTR-EXAMPLE"
  }
}
```

Signature input is the exact timestamp header, a dot and the untouched raw request body. PROCESSING, SUCCESS, FAILED and REVERSED are accepted normalized provider statuses. A FAILED result must include boolean `definitiveFailure:true` to authorize a definitive failure; otherwise it enters review. Optional safe `failureCode` is uppercase letters/digits/underscores, maximum 80 characters. REVERSED can supply `reversalReference`.

Responses: 201 accepted, 201 accepted/duplicate for identical replay, 400 invalid body/result, 401 invalid/expired signature, 404 unknown provider, 409 changed payload under the same event ID. Valid unmatched provider records create MISSING_INTERNAL issues. Amount, reference and UTR inconsistencies never silently settle an order.

## Configuration

`.env.example` contains `PAYOUT_PROVIDER`, reserved future-vendor API URL/key/secret placeholders, webhook secret, polling interval, retry count/delay, minimum/maximum, daily budget, bank cooldown, repeated-failure threshold and stale interval. `PAYOUTS_ENABLED` defaults false. All payout limits and balance threshold values are **paise**. Poll/retry intervals are milliseconds; cooldown/stale intervals are seconds.

`GET /admin/payout-provider/balance` returns `supported:false` for the current mock. An adapter implementing the optional balance method returns integer paise, timestamp, warning threshold and low-balance flag; these are persisted only for treasury monitoring and never exposed through user APIs.

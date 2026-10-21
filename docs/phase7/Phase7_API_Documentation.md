# Phase 7 API additions

Base: `/api/v1`. Existing Phase 3–6 financial APIs are preserved. Admin uses its separate bearer session through the Next.js HttpOnly BFF. Every mutation requires authenticated permission; configuration/account/review mutations require a reason. API JSON limit is 64 KiB.

| Method/path | Permission | Response/action |
| --- | --- | --- |
| GET /system/status | Public, rate-limited | Mode, new-activity flags, version and safe maintenance message |
| GET /admin/operations/dashboard | dashboard.read | Aggregate counts and decimal/integer-string totals |
| GET /admin/operations/users | users.read | Account IDs/status/verification; page/search by ID |
| GET /admin/operations/verification | verification.read | Provider/review status; no documents or secrets |
| POST /admin/operations/verification/:id/note | verification.review | Audited review note; provider decision unchanged |
| GET /admin/operations/banks | banks.read | Masked account, IFSC, bank, verification/default state |
| GET /admin/operations/wallets | wallets.read | Ledger-derived balances |
| GET /admin/operations/ledger | wallets.read | Up to 100 integrity findings |
| GET /admin/operations/rates, fees, limits | settings.read | Versioned immutable policies |
| POST /admin/operations/policy | settings.write | Publish next policy+fee version; existing quotes unchanged |
| GET /admin/operations/audit | audit.read | Safe audit summaries |
| GET /admin/operations/settings | settings.read | Current controls/version |
| POST /admin/operations/controls | settings.write | Atomic version-checked controls and audit |
| POST /admin/operations/users/:id/status | users.manage | active/frozen/suspended, reason; freeze/suspend revokes sessions |
| GET /admin/operations/providers | providers.read | Safe MOCK/NOT_VALIDATED readiness records |
| GET /admin/operations/health, queues | system.monitor | Worker heartbeat summaries |
| GET /admin/engagement/health | system.monitor | Existing detailed worker/failure monitoring |
| POST /admin/reconciliation/:id/resolve | reconciliation.resolve | Resolve issue record with reason; no financial override |

List pages use `page=1..10000`, 50 records; user search is bounded to 100 characters. Dashboard, controls and provider status are small singleton/fixed-size responses. Existing payout/reconciliation and engagement lists retain their documented pagination/limits.

Example control mutation:

```json
{"version":1,"reason":"Approved incident response pause","controls":{"mode":"READ_ONLY","registrations":false,"deposits":false,"sell":false,"payouts":false,"referrals":false,"notifications":true,"support":true}}
```

Mode other than NORMAL blocks all governed new claims even when individual flags are true. `notifications=false` pauses external delivery claims but preserves durable notification records. Deposit pause stops new address allocation, not accounting for funds already sent. Support pause stops new tickets; existing replies remain available.

Policy request fields: `version`, `reason`, `mode` (manual/market/market_plus_margin/market_minus_margin), `manualRate`, `minimumSell`, `maximumSell`, `dailyLimit`, `monthlyLimit` (decimal strings); `fixedFeeMinor` (paise string); `marginBps`, `spreadBps`, `feeBasisPoints`, `quoteExpiry` (bounded integers). Minimum ≤ maximum ≤ daily ≤ monthly; expiry 15–600 seconds. New versions append rather than changing historical terms.

HTTP errors use the existing sanitized envelope. Paused activity, database deadlocks/serialization conflicts and dependency unavailability return 503. Version conflicts return 409; permission failure 403; expired session 401. Retrying a financial request requires its original idempotency key. Do not turn a 503 after unknown provider execution into a new payout attempt.

`/health/live` is process liveness. `/health/ready` checks migration 007, Redis/queues and required worker heartbeat freshness. External provider validation is not inferred from a healthy process. Metrics exporter is private and unauthenticated by design; its network boundary is mandatory.

## RC1 addendum

Phase 8 preserves these API/deployment contracts. See [Phase 8 commands](../phase8/Phase8_API_Documentation.md), [release certification](../phase8/Phase8_Release_Certification.md) and [operator handover](../phase8/Phase8_Developer_DevOps_Handover.md) before any deployment. Production remains blocked pending external acceptance.

# Provider readiness

No external vendor was validated in this phase. Credentials were not supplied and no real transfers occurred.

| Integration | Current implementation | Status |
| --- | --- | --- |
| TRON development | Authoritative isolated in-process transfer fixtures | MOCK |
| TRON HTTP reader | HTTPS bounded-response adapter; configured token/recipient/finality validation | NOT_VALIDATED with external service |
| Custody gateway | Address-allocation interface and authenticated gateway port; no raw key custody | NOT_VALIDATED |
| INR payout | Durable mock provider records, signed mock events, provider-style references/UTR | MOCK; sandbox-labelled fixtures, not vendor SANDBOX |
| OTP | Development encrypted inbox / messaging bridge | MOCK |
| Identity/PAN/document/selfie/bank verification | Vendor-neutral interface with development decisions | MOCK |
| Market rate | Mock provider and authoritative manual-policy support | MOCK for market data |
| Email/SMS/push | Provider ports with mock delivery | MOCK |
| Support object storage | Private storage port; no live upload backend | NOT_VALIDATED |

`GET /admin/operations/providers` reports safe adapter/readiness labels and never credentials. It does not call providers merely to render a dashboard. Configuring a vendor name does not turn NOT_VALIDATED into VALIDATED.

## Production capability gate

`assertProduction()` rejects incomplete/insecure configuration and then explicitly blocks unregistered real provider ports. This is deliberate: an arbitrary name such as `live` cannot bind a mock and silently start production. Remove each code capability gate only alongside a reviewed actual adapter and acceptance evidence. No bypass environment variable exists. Therefore **this archive cannot currently launch a functioning production exchange**.

## Adapter acceptance contract

For each selected provider, implement the existing port rather than changing the domain service. Use secret-manager credentials, HTTPS, bounded responses/timeouts, sanitized failures, capability-aware rails/limits and authenticated status evidence. For payout create operations, stable provider idempotency is mandatory; do not retry unknown outcomes blindly. Validate final state/amount/currency/beneficiary references, signatures, timestamp windows, duplicate events, UTR, reversal and reconciliation behavior.

Read-only provider failover must use the same configured network/token and reconcile cursors/canonical evidence. Never switch custody/payout vendors mid-attempt or change destination automatically. Keep HSM/KMS/custody signing outside the API/database trust boundary.

## Staging acceptance

Create isolated accounts, queues and database. Use vendor-provided sandbox credentials and approved test beneficiaries/tokens only. Record provider/version, network, test case, timestamp, request ID and sanitized evidence. Mark SANDBOX only when it is an actual vendor sandbox; mark VALIDATED only for the specific tested adapter/environment, never as a blanket assertion of production banking success.

Existing fixture tests cover failure, timeout, duplication, replay, reversal and ledger accounting. They are not live-provider tests. Mainnet requires explicit BLOCKCHAIN_NETWORK=mainnet and TRON_NETWORK=tron-mainnet, an independently verified configured USDT contract and an approved confirmation policy. No mainnet activation is performed here.

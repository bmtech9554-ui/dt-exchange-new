# Provider status

DT Exchange · Final Production Setup · based on RC1 1.0.0-rc.1

External provider state: **BLOCKED**. Development adapters remain **MOCK**; no provider is relabeled CONNECTED or VALIDATED.

| Domain | Existing code | Remaining acceptance |
|---|---|---|
| TRON | Read-only tron-http adapter plus mock | Endpoint, official production contract/configuration, confirmations/errors and scan evidence |
| Custody | Configured external gateway port; deterministic nonpayable mock addresses | Gateway allocation contract, ownership/address policy and secure custody approval |
| Payout | Durable mock/sandbox provider abstraction | Vendor adapter, sandbox beneficiary/request/status/webhook/reversal/reconciliation evidence |
| KYC / bank | Mock verification port | Vendor adapters and actual callback/data mapping acceptance |
| OTP / market rate | Development/mock providers | Reviewed actual delivery/market adapters |
| Email / SMS / push | Mock provider ports | Sending/authentication, delivery and native token/permission acceptance |
| Object storage | Private storage abstraction | Real private bucket, encryption/quarantine and owner-scoped upload/download |

Credentials are necessary but insufficient. Provider onboarding must establish supported business, API contract, final-state semantics and secure callbacks before adapter registration. Production startup remains blocked until reviewed implementations replace each missing capability. Configuration strings never prove provider readiness.

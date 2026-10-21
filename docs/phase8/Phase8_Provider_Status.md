# Provider readiness registry

DT Exchange RC1 · 1.0.0-rc.1 · Phase 8

`release/providers.json` is the machine-readable registry. All eight configured development domains are **MOCK**. No provider is VALIDATED or PRODUCTION_READY. The bank verification domain uses the existing verification port; no duplicate database domain was introduced.

| Provider | Current status | Cutover requirements |
|---|---|---|
| TRON | MOCK | Test-network read probe, configured contract review, confirmation/error tests, custody address integration |
| Payout | MOCK | Vendor adapter, sandbox credentials, supported rails, stable idempotency, signed callbacks, polling, reversals, reconciliation |
| Identity/KYC | MOCK | Vendor contract, credentials, signed callback adapter, identity/PAN/document/selfie/risk mapping |
| Bank verification | MOCK | Account+IFSC verification adapter, beneficiary identity rules, vendor reference |
| SMS | MOCK | Sender/template approval and delivery adapter |
| Email | MOCK | Sending domain/authentication, template and bounce adapter |
| Push | MOCK | FCM/APNs project, app entitlement/token lifecycle, delivery acceptance |
| Object storage | MOCK | Private bucket, encryption, owner-scoped access, malware/quarantine, retention |

Status progression: NOT_CONFIGURED → CONNECTED proves connectivity only; SANDBOX labels a vendor test environment; VALIDATED requires recorded acceptance evidence; PRODUCTION_READY additionally requires operational/security approval. BLOCKED denotes a failed requirement. Environment strings cannot promote a provider. Core startup rejects renamed mock-only ports.

Payout onboarding: exchange credentials through a secret manager; verify the beneficiary snapshot and provider rails; use only vendor test beneficiaries. Test repeated request keys, timeout-before-response, polling, signed success/failure/reversal callbacks and UTR mapping. HTTP 200 is not final success. Unknown submission outcome goes to review and lookup, never a new blind transfer. The existing mock callback is `/api/v1/webhooks/payout/mock`; a real adapter must register its own verified path under the same controller contract. No unimplemented vendor endpoint is claimed.

KYC: required fields are user ID, verification type, provider reference, status, submission/review timestamps and rejection reason. Use provider-hosted capture or private owner-scoped upload; keep document/selfie payloads out of logs. Retry safe lookups; reuse provider request references for submissions. Define signed callback freshness/deduplication before registering a vendor callback (not implemented currently). Retention and processing agreements require organizational approval. UI continues to show only Verified or Verification Required.

Provider secret placeholders are in .env.example. Never paste credentials, full bank values or documents into evidence reports.

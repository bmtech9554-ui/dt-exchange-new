# Payout provider acceptance

DT Exchange · Final Production Setup · based on RC1 1.0.0-rc.1

Status: **NEEDS_CREDENTIALS / BLOCKED**. Only the existing durable MockPayoutProvider is available. No live or vendor-sandbox credential was supplied, so authentication, beneficiary setup and vendor request semantics remain unvalidated.

Required: vendor and approved business onboarding, sandbox endpoint/key/secret references, signature/freshness specification, webhook event IDs, supported IMPS/NEFT/RTGS rails, test beneficiary details and response examples for processing/success/failure/reversal. Do not implement a guessed adapter.

Acceptance sequence: verify sandbox authentication → beneficiary mapping and encrypted snapshot → create one sandbox payout with stable request key → repeat same key → status lookup → signed callback → duplicate callback → invalid/expired signature → failure/reversal → UTR/reference mapping → reconciliation. A timeout requires lookup of the original key before any retry. HTTP 200 must never be interpreted as payout success. Keep original attempts and append-only reversal journals.

Local regression covers this lifecycle against the mock provider, including duplicate protection and ledger settlement. It does not demonstrate a bank transfer. No public webhook URL was tested because staging/TLS are absent. Do not send real INR, fund a live beneficiary, or enable payouts as part of automated setup. A real-money test would require separate explicit authorization after all readiness gates close.

# KYC and bank verification readiness

DT Exchange · Final Production Setup · based on RC1 1.0.0-rc.1

Status: **NEEDS_CREDENTIALS / BLOCKED**. Existing verification provider is mock; real vendor adapters are not configured. Profile and onboarding UI remain unchanged.

Required inputs: vendor choice/documentation, sandbox endpoint/authentication, identity/PAN/document/selfie/risk and bank request fields, callback signature/event/timestamp contract, retry rules and approved retention. Bank account+IFSC/penny-drop verification depends on the chosen provider's approved test workflow.

Validate request formatting, provider reference persistence, owner-scoped documents, status mapping, rejection reasons, safe retries, duplicate callbacks and account activation rules. Never accept unsigned verification/financial callbacks. Real KYC/bank webhook routes must be implemented for the chosen adapter; none is invented in this report. Only existing onboarding/account flow may trigger required verification; do not add profile KYC menus.

External organizational requirements: permitted data processing, provider agreement, retention/deletion exceptions and required review/reporting policy. Keep documents private and sensitive payloads out of logs. Credentials alone do not establish vendor authorization or legal approval.

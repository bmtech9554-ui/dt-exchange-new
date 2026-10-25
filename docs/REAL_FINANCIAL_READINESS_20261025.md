# DT Exchange — Real Financial Readiness Gate (25 October 2026)

Status: **BLOCKED_FOR_LIVE_FINANCE**. This is an evidence checklist, not authorization to activate real funds.

## Scope and verified baseline
- Existing architecture: Flutter, NestJS, PostgreSQL ledger, Next.js admin, Redis/BullMQ.
- Manual deposits: proof/TxID review, independent read-only TRON corroboration described in `docs/PRODUCTION_TRANSITION_20261020.md`, atomic ledger posting, duplicate prevention.
- Sell: server quotes, rate/limits, wallet reservations, manual payout, receipt and UTR controls.
- Demo: `DT_PUBLIC_TEST` / `DT_SIMULATION_RELEASE` flags and isolated test endpoint in `mobile/lib/public_test/test_mode.dart`.
- Do not assume the handover's local signed Build 8023 is present in GitHub or published.

## Mandatory go/no-go gates (all require owner-supplied evidence)
| Gate | Required evidence | Current assessment |
| --- | --- | --- |
| Legal / compliance | Written jurisdiction-specific review of VDA/OTC operations, AML/KYC, sanctions, tax/TDS, recordkeeping, business-bank authority, privacy and customer terms; named accountable approver | BLOCKED |
| Identity and AML | Approved production KYC/risk/sanctions provider, webhook authentication, adverse decision handling, manual escalation and negative tests | BLOCKED |
| Bank verification | Approved verification process/provider, beneficiary ownership, payout limits, maker-checker and rejection handling | BLOCKED |
| Custody and TRON | Authorized business receiving address, verified USDT contract/network, custody policy, approved HTTPS RPC, finality/reorg policy and chain-event acceptance | BLOCKED |
| Ledger and money safety | Live-like PostgreSQL migrations, transaction locking, idempotency, double-credit/spend tests, reconciliation and exact decimal handling | NOT ACCEPTED |
| Manual INR payout | External bank evidence and independent reconciliation, unique UTR, permissioned receipt, uncertain-payment escalation, no automatic payout | NOT ACCEPTED |
| Admin security | MFA, least-privilege RBAC, dual approval where required, access logs, secret rotation, incident runbook | NOT ACCEPTED |
| Infrastructure | Cloudzy ownership/access, HTTPS/CORS, TLS PostgreSQL/Redis, private evidence storage/key recovery, backups and restore drill, monitoring/alerts | NOT ACCEPTED |
| Android release | Verified signed APK, original certificate/package identity, physical install/upgrade/session and end-to-end staging acceptance | NOT ACCEPTED |
| CI/security | Reproducible npm lockfile, clean high-severity dependency audit, full test/build/integration runs | NOT ACCEPTED |

## Non-negotiable engineering controls
1. Keep real-money deposit credit, live payouts and financial activation **OFF** until every gate passes and a separate explicit cutover is approved.
2. Do not enable automatic blockchain credit or automated INR payout for the manual operating model.
3. Never credit on user-provided TXID/proof alone; corroborate a canonical confirmed TRC20 USDT event and unique chain-event key.
4. Maintain append-only, balanced, transactional journals and idempotent reserve/settle/reversal.
5. Do not migrate simulated balances, bank records or test identities into production.
6. Preserve all existing users, migrations, backups, signing identity, logo and UI; use additive changes only.
7. Require documented two-person reconciliation for disputed or uncertain bank transfers; a receipt upload is not bank verification.
8. Never publish an APK or claim live readiness based solely on local build/test documentation.

## Implementation order
1. Reconcile GitHub source with the local Build 8023 handover and resolve npm lockfile/CI failures without weakening security gates.
2. Audit existing backend configuration guards and production adapter fail-closed paths; add focused negative/security tests for attempted activation without providers.
3. Implement approved KYC/risk and bank-review adapters behind disabled feature flags with isolated staging fixtures.
4. Verify read-only TRON adapter against an approved test environment and independently check event index, contract, recipient, amount, confirmations and reorg behavior.
5. Exercise real PostgreSQL/Redis staging concurrency, ledger integrity, payout reconciliation and backup/restore.
6. Verify Android physical-device update, backend connectivity and complete manual end-to-end staging workflow.
7. Collect independent compliance, security and operator sign-off; request **separate** explicit authorization before any live financial activation.

## Current work boundary
This document only records the verified gaps and execution gates. It does not assert successful current CI, runtime tests, staging verification, production deployment, or real-money authorization.

Sources: `docs/CURRENT_HANDOVER.md`, `docs/PRODUCTION_TRANSITION_20261020.md`, `docs/manual/Updated_Production_Blockers.md`, `docs/manual/Manual_Operations_Implementation.md`, `backend/package.json`, `mobile/lib/public_test/test_mode.dart`.

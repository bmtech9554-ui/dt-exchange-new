# Production transition audit — 20 October 2026

Status: **INCOMPLETE / NOT AUTHORIZED FOR REAL FINANCIAL ACTIVATION**.

Working source: `C:\DTExchange\recovered-8018-8021`. This folder is not a Git checkout.
Build 8022 remains the signed, installed simulation artifact. Local source changes
in this report have not been deployed or included in that APK. The original project,
VPS, production accounts, balances, database and public download were not changed.

## Implemented in this continuation

- Manual deposit approval on a real network now corroborates operator-entered evidence
  using the existing read-only TRON HTTP adapter. It requires one matching successful,
  canonical USDT transfer, the correct network, contract, recipient, sender, amount,
  timestamp and block, and enough observed confirmations. Reader failures and
  conflicting or ambiguous evidence fail without credit. Manual approval, permission
  checks, transaction locks, limits and permanent ledger idempotency remain.
- The actual chain event index and observed confirmations are recorded, together with
  the independent verification source and check time. Previously the manual path
  always stored event index zero and relied only on entered evidence.
- Production startup requires an HTTPS TRON reader when manual credits are enabled.
  The local configuration example documents that dependency; financial flags remain
  false. Read-only verification does not enable automatic credit or payouts.
- Production manual mode no longer waives customer verification or allows
  self-declared banks to qualify for a quote/order/payout. Non-production test
  exceptions remain isolated. This exposes the missing real identity integration
  as a blocker instead of treating simulated eligibility as operating approval.
- The admin chain timestamp input accepts millisecond precision for exact comparison.
- Removed unreachable obsolete wallet-placeholder text. The normal Wallet route
  already uses the API-backed page; preview fixtures remain explicitly isolated.

## Source audit and implementation boundaries

| Area | Existing implementation | Outstanding production evidence or software |
|---|---|---|
| Wallet | PostgreSQL append-only double-entry journals, balance queries, reservations and reversals | Live migration/restore, reconciliation and operating acceptance |
| Deposits | Private proof intake, review, exact limits, duplicate claims, atomic ledger credit; new RPC corroboration | Approved custody address, contract/network/confirmation policy, RPC credential and real-chain acceptance |
| Sell | Backend quotes/rate policy, bank selection, atomic reservations, limits, manual processing and failed-payment recovery | Verified customer/bank integration and staging end-to-end acceptance |
| Manual payout | Actual UTR input, private evidence, exact amount/time checks, permissioned settlement, unique UTR/receipt and immutable audit | External bank settlement verification procedure and operator acceptance; uploaded evidence is not independently authenticated by a bank API |
| Admin | Existing user/order/deposit/payout/ledger/settings/audit/reconciliation controls and MFA/RBAC | Full browser acceptance with authorized staging operators; not certified by unit tests alone |
| TRON | Existing HTTP reader plus manual approval corroboration | Provider response/finality/reorg acceptance against approved infrastructure; not certified as a complete live custody/indexing system |
| Identity/AML | Verification ports and risk flags; production verification now enforced | Real identity/risk provider adapter, authenticated decision integration and approved operating workflow still missing |
| Bank verification | Manual review provider returns `under_review`; records and admin controls exist | Approved evidence/review process or accepted verification provider; self-declaration is insufficient in production |
| OTP | Existing SMS adapters and credential validation | Approved provider credentials, delivery/security acceptance |
| Rates | Database-backed manual policy; market provider remains a mock port | Manual policy is sufficient for requested fixed rate; do not enable unimplemented market mode |
| Automatic payout | Mock adapter retained for isolated tests, disabled manual-production port | Not required by the requested manual banking model; keep automation disabled |
| Notifications/storage | Persistent in-app records and encrypted financial files | External email/SMS/push and support attachments remain disabled where adapters are missing; storage capacity/key recovery acceptance |
| Flutter | API-backed normal paths; explicit preview and simulation paths, separated sessions | Real-provider/device acceptance and a new signed release after engineering gates pass |
| Nginx/website | Separate API/admin/site hosts, explicit APK alias, rate/body limits, historical 8018 route restriction | Validate deployed config and new build routing in staging; preserve public APK until approval |

Simulation routes (`backend/src/public-test`), mock providers and Flutter preview
fixtures are retained for isolated testing. They are not relabeled as real
operations, and no demo balances are copied to production.

## Read-only production observations

Two public endpoints under `https://api.dtexchange.app/api/v1` responded HTTP 200:
`app/configuration` and `app/terms`. Published terms were ₹103 per USDT, minimum
sell 100 USDT, maximum sell 5,000 USDT, zero published sell/deposit fee, deposit
minimum 100 and daily deposit limit 20,000. No settings were changed.

These responses do not establish the deployed source revision, database integrity,
private configuration, live authentication, enabled financial controls or provider
readiness. No SSH/server/database audit was performed in this continuation.

Evidence: `.audit/production-public-readonly-probes.json` and
`.audit/production-public-configuration.json`.

## Validation

| Check | Result |
|---|---|
| Backend compilation and regression suite | 320 passed, including 23 new chain/configuration/eligibility cases |
| Admin regressions | 60 passed |
| Flutter regressions | 405 passed |
| Dedicated PostgreSQL / Redis integration | 93 passed; test services stopped afterward |
| Flutter analysis | No issues |
| Admin TypeScript | Passed |
| Design tokens | Match |

Logs are `.audit/production-transition-{backend,admin,flutter,integration,analyze}.log`.
The first integration attempt used an incorrect local PostgreSQL startup port and
Redis working directory. Those harness startup errors were corrected and the
complete integration suite rerun successfully. Tests used synthetic fixtures only.
These results do not certify live providers, bank settlement or a new APK.

## Requested final status

- SIMULATION REPLACEMENT: INCOMPLETE.
- REAL TRC20 ENGINE: INCOMPLETE — reader and corroboration implemented/tested,
  live-chain acceptance outstanding.
- DEPOSIT BACKEND: PASS — local automated tests only.
- SELL BACKEND: PASS — local automated tests only.
- WALLET LEDGER: PASS — local automated tests only.
- ADMIN APPROVAL: PASS — local automated tests only; browser/device acceptance pending.
- MANUAL PAYOUT SOFTWARE: PASS — local automated tests only.
- PAYMENT RECONCILIATION: PASS — local ledger/evidence/recovery tests only;
  external bank reconciliation acceptance pending.
- ANDROID BUILD: NOT READY — no new production APK.
- PRODUCTION API: NOT READY — public responses are available, but production
  readiness and deployed revision are not verified.
- REAL FINANCIAL ACTIVATION: PENDING.

## Release preparation

Proposed next versionCode: **8023**, subject to checking for newer releases at
signing time. Preserve `com.dtexchange.dt_exchange` and original signing certificate
SHA-256 `475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c`.

Do not reuse the Build 8022 simulation signing manifest for a production candidate.
No new APK was compiled or signed in this continuation: the requested engineering
and production acceptance gates are still incomplete. No credentials or signing
passwords are required in chat. Use local masked signing only once a candidate is
ready. Keep 8022 installed until an authorized replacement passes release checks.

## Operating and integration checklist

- Select the real identity/risk integration and provide its API/decision contract
  and sandbox access through secure local configuration; implement and accept it.
- Approve the bank-verification workflow and evidence requirements; validate account
  ownership and manual payout authorization independently of a self-declaration.
- Verify business custody ownership, network/token contract, read-only RPC access,
  finality/reorg behavior and the actual deposit reconciliation procedure.
- Validate OTP delivery, authenticated admin MFA/roles and customer session recovery
  in isolated staging with real adapters.
- Complete staging DB/Redis TLS, migrations, rollback, backup/restore, encrypted file
  recovery, queue restarts, reconciliation, monitoring and capacity acceptance.
- Record applicable organizational/customer-verification/AML/banking requirements
  and approval evidence. This audit does not determine legal compliance.
- Finish physical-device workflows, biometric authentication, receipts/downloads,
  theme/animation/support and production-mode session isolation acceptance.
- Prepare/verify/sign 8023 only after those engineering gates; verify upgrade and
  backend connectivity without importing simulation sessions or balances.
- Obtain separate controlled activation and website-publication authorization.

No automatic banking adapter is needed for this manual payout scope. Missing
operating evidence must not be replaced with fabricated receipts, success responses,
provider implementations or verification decisions.

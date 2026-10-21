# Build 8018 normal-user Deposit / Sell activation preparation

Status: **PREPARED_NOT_DEPLOYED**. This is a concrete inactive candidate, not
production activation or a claim of legal clearance. Latest live inspection:
13 October 2026, 13:33 UTC. The user requested preparation and exact blockers.
Production execution remains gated. No production financial records, settings,
roles, services, customer text, APKs or receiving address were changed.

## Smallest prepared scope

1. Extend the existing Build 8018 Nginx allowlist with only five patterns for
   manual configuration, proof upload, deposit submission/resubmission and Sell
   quotes/orders. Use the actual production API for **every normally eligible
   authenticated user**, not a synthetic identity, client IP or disposable
   backend. Existing account routes remain unchanged. The client build header
   is untrusted and is never used as financial authorization.
2. Supply the missing `TRON_PROVIDER=tron-http` and USDT contract reference
   `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`. Add missing enabled mainnet/network/token
   rows transactionally with the existing 20-confirmation threshold. Conflicting
   rows abort; existing rows are not overwritten. These are reference inserts,
   not a schema migration or seed. Migrations 001–021 must not be rerun.
3. Set `TRANSACTIONS_ENABLED=true` only in the future approved cutover. Retain
   manual review, eligibility/risk checks, proof ownership, permanent TxID
   claims, balance checks, idempotency, immutable quotes/beneficiaries, RBAC,
   recent admin authentication and append-only financial/audit records.
4. Deploy two small independent opt-out guards before enabling that shared
   switch: `OWNER_WALLET_ADJUSTMENTS_ENABLED=false` and
   `REFERRAL_REWARD_RELEASE_ENABLED=false`. These prevent unrelated owner
   adjustments and old referral reward releases from becoming executable as a
   side effect. No role changes. Omitted flags preserve existing behavior; `true`
   never overrides the global transaction pause or permission checks. Invalid
   values fail configuration validation.

No Flutter or admin UI changes, new provider integration, credentials, Android
signing, APK rebuild or publication are needed for this candidate. The compiled
backend patch has three files, and is hash recorded alongside its source.

The backend transaction switch is global: enabling it also permits these same
authorized operations from other supported clients, including public Build 8011.
This is normal-user activation, not a Build 8018 security exception. The future
cutover approval must acknowledge that scope; the client-controlled version
header cannot safely limit financial authorization to a particular APK.

The token contract was independently checked against
[Tether's issuer documentation](https://tether.to/en/supported-protocols/).
It is not the deposit receiving address. The database receiving address still
matches the user's approved TRC20 address exactly.

## Manual review and automation

Keep these values in both API and engagement worker:

```dotenv
MANUAL_DEPOSIT_REVIEW=true
MANUAL_PAYOUT=true
MANUAL_DEPOSIT_SUBMISSIONS_ENABLED=true
AUTOMATED_BLOCKCHAIN_CREDIT=false
AUTOMATED_PAYOUT=false
REFERRAL_PROGRAM_PAUSED=true
ANDROID_UPDATE_ENFORCED=true
OWNER_WALLET_ADJUSTMENTS_ENABLED=false
REFERRAL_REWARD_RELEASE_ENABLED=false
```

A submitted deposit remains `UNDER_REVIEW` with **no submission-time credit**.
Manual approval is a separate authorized financial action which credits the
ledger only after the existing matching verification requirements. The reviewer
must independently verify the real chain transfer; the manual service checks
the supplied evidence and does not fetch or manufacture blockchain confirmation.
The automatic TRON provider remains the dormant manual-mode implementation even
though the non-mock chain identifier is needed for normal orders. No automatic
scanner, credit worker or payout provider should be started.

## Sell submission versus completed manual settlement

The base candidate deliberately preserves `PAYOUTS_ENABLED=false`. A funded
Sell can reserve/convert approved wallet funds and enter `READY_FOR_PAYOUT`;
this is **not** a completed customer payout. The existing customer must have
adequate approved USDT and an eligible bank account; no balance is invented.

The earlier requested manual-settlement scope is retained as an explicit,
unapplied extension (`PAYOUTS_ENABLED=true`). It must not be included silently.
Do not invite customers to sell against an unserviceable settlement path.
Before full Deposit/Sell launch, resolve and approve the following discrepancy:

| Live setting | Verified value |
| --- | --- |
| Maximum sell | 5,000 USDT |
| Final customer rate / separate fee | ₹103 / 0 |
| INR due for maximum sell | ₹515,000 |
| `PAYOUT_MAX_AMOUNT` effective default | 10,000,000 paise = ₹100,000 |
| `PAYOUT_DAILY_LIMIT` effective default | 100,000,000 paise = ₹1,000,000 platform-wide |
| New-bank cooling period | 86,400 seconds |

`ManualService.process` enforces these controls. A 5,000-USDT order can currently
be quoted but cannot be processed under that per-payout ceiling. The smallest
numeric ceiling covering the approved maximum would be 51,500,000 paise; **that
change has not been approved, written into the candidate or applied**. The daily
platform budget and bank cooling control are separate and remain unchanged.

## Live blockers verified

- Build 8018's account-only Nginx policy currently returns 403 for manual
  configuration/intake and Sell routes. The old login-wide 503 is already fixed.
- `TRANSACTIONS_ENABLED=false`, `PAYOUTS_ENABLED=false`; normal manual intake is
  already true. No global restricted beta is proposed.
- `TRON_PROVIDER` is unset, contract empty, mainnet reference rows absent.
  Simply enabling execution fails startup with `INVALID_TRON_CONTRACT`.
  The prepared reference/configuration combination passes a short-lived
  evaluation using the deployed code, without altering its running environment.
- The new two opt-out guards are absent from deployed code. They must be
  deployed and verified before their configuration can be relied upon.
- Full manual settlement has the payout-ceiling mismatch above. No production
  rates, fees or limits were changed to hide it.
- Final operator identity and supporting operating/privacy review evidence are
  still unavailable, as the user explicitly confirmed. No published documents
  were returned under the inspected legal settings keys. This inspection does
  not establish which external legal obligations have been satisfied. Qualified
  review and evidence of the permitted real-money service scope remain needed.
  No Privacy Policy or other customer wording was created or changed.
- A fresh, exact controlled-cutover approval and final backup/rollback checks
  are still required. Approval of an expired isolated test is not authorization
  for normal-user financial activation. Public APK replacement is separate.

## Validation and artifacts

Inactive package: `.tools/manual-financial-activation-prepared/`.

- `manifest.json`: scope, holds, exact five-key runtime patch, preservation list,
  deployment order, source/compiled artifact hashes and optional settlement step.
- `runtime.candidate.env`: patch only, never a complete or secret environment.
- `android-8018-access.candidate.json` / `.map.conf`: additional customer routes.
- `reference-data.transaction.sql`: conflict-checked inserts in one transaction.
- `backend-patch/`: three compiled files; use the established immutable-image
  build/cutover procedure rather than editing a running container.
- `preparation.test.mjs`: reference idempotency/conflicts, exact routing,
  preservation of account access, scope holds, hashes and integer payout math.
- `nginx-syntax.json`: actual VPS Nginx parser passed via an anonymous in-memory
  file descriptor. No server file installation, listener start or reload.
- `backend-all.log` and `preparation.log`: regression results.

Completed results: **280/280 backend tests passed**, **7/7 preparation tests
passed**, TypeScript compilation passed, and the actual Nginx syntax check
passed. The three compiled candidate files were compared with live production
hashes after removing only the reviewed additions: all three matched exactly.
This rules out accidentally including other staged backend changes in this
patch. `patch-baseline.json` records the comparison.

Application source changes are limited to:

- `backend/src/config/environment.ts`: validate the two optional opt-out flags.
- `backend/src/modules/owner/owner.service.ts`: honor the wallet-adjustment opt-out.
- `backend/src/modules/referrals/registration-rewards.ts`: honor the release opt-out.
- `backend/test/scoped-manual-activation.test.mjs` and `backend/test/manual.test.mjs`:
  focused permission, pause and normal Sell regression coverage.
- `deployment/cloudzy/runtime.env.example`: document conservative opt-out values.

Canonical deployed routing templates remain unchanged; only an inactive candidate
was generated. No new migration, administrator or signing identity was created.

Backend tests cover ordinary wallet-funded Sell requests with both unrelated
owner writes opted out, payout processing still gated, balanced journals,
manual deposit/proof/duplicate handling, authentication and role restrictions.
Tests use disposable local financial records only. They are not proof of an
activated normal-user production flow. Flutter was not changed or rebuilt;
previous Samsung evidence remains unchanged.

Fresh live checks passed: API readiness, PostgreSQL, Redis, queues, engagement
worker, website/admin/download HTTPS, unchanged production container identity,
closed isolated window, unchanged public Build 8011 checksum. Build 8018 remains
unpublished and uses the same production signing identity.

## Controlled deployment and recovery procedure (not executed)

1. Resolve external evidence and exact manual-settlement scope/ceiling; obtain
   explicit approval for the final reviewed package and any policy change.
2. Recheck strict SSH, live drift, service health, resource headroom, current
   immutable API/engagement rollback images, encrypted backup integrity and
   restoration readiness. Securely preserve runtime/Compose/Nginx configuration
   and financial/settings fingerprints. Never print secrets.
3. Build the minimal immutable API/engagement image from the verified deployed
   source plus the three-file guard patch. Verify deployed-source compatibility
   and artifact hashes. First deploy with transaction/payout switches still off.
   Confirm the new guards are loaded before applying execution settings.
4. Apply only the reference-data transaction with stop-on-error. No migrations,
   balances, policy values, roles, existing proofs or customer records are reset.
5. Apply the reviewed runtime patch to API/engagement, including any separately
   approved settlement changes. Confirm readiness, manual provider bindings,
   disabled automation and effective payout limits before opening customer routes.
6. Replace only the Build 8018 map, preserve both existing proxy locations and
   error envelope, run full `nginx -t`, reload and validate ordinary authenticated
   routes. Verify unauthorized/duplicate/expiry/limit/proof-denial behavior using
   isolated evidence; do not execute a real transfer as a deployment test.
7. On failure, stop new intake/orders, restore routing/runtime/image baselines
   with execution paused, and verify service health. Never erase reference rows
   referenced by new records, journals or customer transactions. Any customer
   liabilities created after opening access require manual reconciliation.

The base package alone is not an end-to-end settlement launch. Production remains
unchanged until prerequisites and the exact cutover scope have been approved.

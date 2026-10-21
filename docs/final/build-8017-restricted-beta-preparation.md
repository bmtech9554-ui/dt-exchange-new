# Build 8017 restricted beta — staged, not deployed

12 October 2026. This is an engineering test boundary, not a legal/compliance
clearance, public release or completed production cutover.

## Implemented locally

`PRIVATE_BETA_MODE` defaults off. Enabling it is an explicit production access
change and requires a separate approved cutover. It is not enabled on the VPS.

- Startup fails unless manual review/payout stay true; automatic credit/payout,
  transactions, payouts and normal manual-deposit intake are explicitly false;
  and the backend referral pause is true. Invalid mode values fail closed.
- Customer access uses the existing dedicated synthetic-validation account,
  existing database protection triggers and exact approved Android build. Its
  JSON setting must contain explicit `startedAt` and `expiresAt`, with a total
  window no longer than 60 minutes. A missing, future, expired, disabled or
  mismatched window denies access. Expiry never reopens ordinary service.
- Ordinary registration is denied before account creation. Non-allowlisted OTP
  requests do not send SMS. Existing sessions, new sessions, OTP verification,
  password recovery and refresh cannot bypass the account boundary. Normal
  password/OTP/JWT validation remains. Logout stays possible after expiry.
- The authenticated test deposit configuration returns
  `DT-SYNTHETIC-NONPAYABLE`, which is not a valid TRON address. The stored receiving
  address is unchanged and remains visible to the authorized owner. The unchanged
  app already renders explicit sandbox/non-payable notices for this response;
  no customer wording, APK or widget implementation was changed.
- New test deposits are permanently synthetic and non-creditable, still require
  private proof and valid TxID, retain duplicate protection and enter UNDER_REVIEW.
  Resubmission of ordinary deposits is denied in beta. This does not suppress or
  rewrite historical records: previously disclosed public addresses cannot be
  revoked by a software flag.
- Bank creation is limited to the existing explicitly synthetic, non-payable
  fixture. Quotes require such a bank, keep the approved rate/fee/limits/expiry,
  and never enable order execution. Other customer writes default to denied.
- Ledger posting is blocked for all application callers while beta is enabled,
  including owner adjustments and workers. Existing independent gates and
  synthetic database triggers remain in place. Admin login/RBAC/reads are retained;
  this does not add roles, reset credentials or grant financial permissions.
- Registration/OTP onboarding and completed payout/receipt workflows are tested
  using the isolated disposable harness. The live restricted beta does not create
  real users, manufacture payouts or credit even a synthetic production balance.

## Validation

- Backend compile passed; full backend tests: **263 passed**, including the
  existing default-off regression and new beta integration/boundary checks.
- Focused beta/manual suite: **45 passed**. Actual Nest controllers/services and
  all migrations run against a disposable PGlite database. Tests assert synthetic
  deposit/private proof, duplicate rejection, blocked approval, synthetic bank,
  exact quote/expiry, blocked order, expired/revoked access and unchanged ledger.
- Flutter analysis passed. Full Flutter suite: **401 passed**, including two
  new 320/390-pixel compatibility tests using unchanged application widgets.
- Existing admin/website **51 passed** and typecheck evidence retained. No admin
  source was changed and no new owner login/TOTP was requested.
- Samsung reconnected authorized; installed package is still 1.0.0+8017. Fresh
  Profile -> Referral Program -> Coming Soon/gift animation -> Back -> Home check
  passed. Prior accepted 8017 physical tests remain valid. The staged backend beta
  itself has NOT been tested against this phone or production, because it is not
  deployed. No new OTP was sent.

Evidence: `.tools/private-beta-focused.log`, `.tools/private-beta-full-backend.log`,
`.tools/private-beta-flutter-analyze.log`, `.tools/private-beta-full-flutter.log`.
The source checksums and test counts are frozen in
`.tools/private-beta-preparation-manifest.json`; verify them before building a
deployment candidate.

## Live state rechecked, not changed

API, web, PostgreSQL, Redis and engagement worker are healthy. All 21 migrations
remain applied; no new migration is needed. Financial settings digest remains
`eef37fbd8e35d85bb875b2cea19119c76651db3b14a6a512dd93a8813c5b0182`.
One active owner remains. Both automation flags and existing execution gates are
false. The old synthetic window remains disabled. Normal registration and manual
deposit evidence intake are still enabled from earlier approved deployments:
the current live service must not be described as a restricted beta yet.

HTTPS website/admin/download/release API returned 200. Private API readiness
passed. Encrypted logging recovery, archive integrity, 180-day configuration,
timers and monitoring delivery passed. Approximately 232 GB free, no backlog or
capture gap. Monitoring reports failed SSH login bursts; fail2ban and SSH
protection remain active, with no claim that these attempts prove compromise.
India storage remains unverified. Recent encrypted database backup/full archive
parse and prior isolated restore evidence are retained; refresh/reverify backup
before any approved cutover.

Final read-only rollback check: current API and engagement image IDs are both
available and inspectable. Latest encrypted database backup is 8.65 hours old;
checksum plus authenticated full parse passed again. No production restore was
performed. The on-server public APK bytes still match the verified 8011 hash.

Build 8017 is unchanged, signed with the existing production identity, 60,219,794
bytes, SHA-256 `d1a3731d1aaf2ba4dae45fd09711b69916393d4fd7ca786fc540d54ba5d3aecc`.
Signed metadata/attestation preparation is unchanged and was accepted by the
deployed verifier in a read-only check. Public Build 8011 remains available with
SHA-256 `8fa26acc6c86fd18ce9aad40dbc85053f39d71f248aa792267e2eb23d339545b`.
No signing, rebuild, migration or publication occurred.

## Exact approval scope before activation

This is a material narrowing of live customer access, not merely installation of
an unpublished APK. Obtain explicit approval for all of the following together:

1. Verify strict SSH, API/data health, current image identities, disk space and
   encrypted database backup; retain root-only deployment configuration and
   inspectable exact API/worker rollback images. Stop if a prerequisite fails.
2. Build/deploy only the tested backend/engagement image including the staged
   referral pause and beta safeguards. No database migration, web rebuild,
   financial-value change, Android rebuild or public APK replacement.
3. Set `PRIVATE_BETA_MODE=true`, `REFERRAL_PROGRAM_PAUSED=true` and
   `MANUAL_DEPOSIT_SUBMISSIONS_ENABLED=false`. Preserve all other financial
   execution flags at false, both manual-mode flags at true and all approved
   rates/limits. Normal user API access and new signup will be closed while this
   mode remains enabled. Owner authentication/read access is retained.
4. Use a brief fail-closed API ingress maintenance gate while changing images;
   verify Nginx configuration before any reload. The website/public APK stays
   available. Restore API ingress only after the new restriction is verified.
5. Authorize only the existing dedicated synthetic account and Build 8017 for
   at most 60 minutes with a fresh explicit start/end and an audit record. Use
   synthetic proof/bank/TxID data only; no normal financial records are amended.
6. Verify existing owner access securely, the unchanged Samsung app, customer
   exclusion, synthetic-only submission/quotes and ledger invariance. Disable
   the test window immediately after testing, retaining beta mode and disabled
   normal intake. Expiry also closes access; it does not silently reopen service.

If candidate validation fails, keep API ingress closed before restoring verified
old images. **An older image does not implement the new beta guard**, so an image
rollback alone must not restore customer ingress. Website/8011 download remain
available. Report the failure and require an explicit decision before returning
to ordinary production access. Never reset or restore over the production DB.

## Publication holds

Unchanged from the release review: confirmed legal operator/contact/disclosures;
documented applicable VDA/FIU/AML/customer-due-diligence, banking/custody and tax
clearance; Indian-jurisdiction log/incident-response evidence; and substantiation
for existing financial guarantees. No policy or customer text was edited. A
limited synthetic test does not establish an exemption from applicable duties.

Current result: engineering preparation VERIFIED; live beta deployment and
Samsung beta acceptance PARTIAL/pending approval; financial-service activation
and public Build 8017 publication BLOCKED.

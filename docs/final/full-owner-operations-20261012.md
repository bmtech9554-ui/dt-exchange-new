# Full customer access and owner operations — 12 October 2026

Status: **approved core API/admin deployment completed; production healthy; interactive owner acceptance passed**.
The rejected restricted-beta cutover is not authorized and is excluded from the prepared API patch. Normal customer registration, OTP, login and nonfinancial account access must remain available.

## Live evidence collected without a production mutation

- Website, admin, download page, public application configuration and release metadata: HTTPS 200 with certificate verification.
- API, web, PostgreSQL and Redis healthy; engagement container running with its existing heartbeat monitoring.
- One existing active OWNER_ADMIN; password credential and TOTP enrolled. No missing required owner permissions, no SUPER_ADMIN or FINANCIAL_ADMIN grant. No account or credential changed. This is a database/permission audit, not a new interactive owner login.
- All three encrypted bank records have complete decryptable numbers matching their stored last four digits. No numbers or personal records printed or exported.
- Operational mode NORMAL; registrations/support/normal customer controls unchanged. App, website and API maintenance OFF. Manual evidence intake enabled. No synthetic-only access window or private-beta configuration enabled.
- Manual deposit review and manual payout true; automated blockchain credit and automated payout false; TRANSACTIONS_ENABLED and PAYOUTS_ENABLED false.
- Financial settings digest unchanged: `eef37fbd8e35d85bb875b2cea19119c76651db3b14a6a512dd93a8813c5b0182`. No ledger-integrity issues.
- Migrations 001–021 already applied. This update requires **no migration** and no new RBAC grants.
- Existing encrypted database backup: approximately 8.91 hours old at verification, root-only, checksum correct, authenticated age decryption and full pg_restore parse passed. No restore into production. Previous isolated restoration procedure remains the recovery reference.
- Current API and engagement rollback images are available and inspectable. Recheck image IDs, backup age, disk and health immediately before an approved deployment.

## Implemented changes

1. Sensitive bank access requires its existing explicit capability and an active session. A session authenticated within five minutes may reveal; older sessions require a fresh single-use TOTP. Rate limits apply. Codes never extend session lifetime or enter audit payloads.
2. User Details now includes masked holder/account details and the same reveal/hide/copy control used by Bank Accounts. Full digits are fetched only after explicit confirmation. Values clear after 30 seconds, window blur, session expiry, record change or unmount. Failed/missing data is never fabricated.
3. Payout beneficiary inspection is a separate authenticated, audited read of the immutable encrypted payout snapshot. It does not start or retry a payout. Existing payout processing remains separately permission/eligibility gated.
4. Payout proof has a private upload/preview/download draft step. It can be replaced before confirmation. Upload does not mark paid. Final confirmation requires an explicit bank-transfer-success attestation plus the existing exact amount, UTR, timestamp, receipt ownership and idempotency checks. Finalized evidence remains immutable.
5. Owner sell details include contact/public user ID, quote amounts/rate, masked bank, payout references, notes and history. Review/rejection holds an unprocessed request in MANUAL_REVIEW with its liability intact. It does not issue a refund, release money or automatically resume a rejected request. Further financial resolution remains separately authorized.
6. Final manual payment confirmation now honors PAYOUTS_ENABLED; owner wallet adjustments honor TRANSACTIONS_ENABLED. Normal reads remain available while execution is gated.
7. Notification inbox refreshes every 30 seconds while visible; existing badge, permission-filtered events, deduplication and related-record links remain.
8. Admin session navigation uses one authenticated capability query instead of probing every module. Backend permission guards remain authoritative. This fixes the rate-limit failure reproduced during browser navigation without raising request limits or caching authentication.

No Flutter source, branding, logo, customer copy, Privacy Policy, financial value or signing identity changed.

## Validation

- Backend TypeScript: PASS; complete backend suite **269/269 PASS**.
- Admin tests **55/55 PASS**, typecheck PASS, production Next build PASS.
- Flutter analyze: no issues; **401/401 tests PASS**. No APK rebuild needed.
- Real local admin browser → BFF → NestJS → disposable PGlite database flow: PASS. Synthetic credentials and records only; no production requests or real transfer.
- The browser run passed login, receipt upload, protected preview, paid-confirmation safeguards, matching downloaded receipt checksum, User Details, bank reveal, fresh TOTP step-up, hiding on blur and widths 360/768/1440.
- API checks: other user denied, anonymous denied, expired access denied, missing proof handled, encrypted storage, correct user/payout association, duplicate confirmation protected, zero ledger-integrity issues.
- Exact six-file API patch (including manual service with beta branches removed) was loaded for the final isolated browser acceptance run.
- Existing Samsung Build 8017 acceptance and Flutter proof-view/zoom/download evidence remain applicable; no fresh production financial test or new physical installation claimed in this task.

Evidence: `.tools/full-operations-backend.log`, `full-operations-admin.log`, `full-operations-admin-build.log`, `full-operations-flutter-analyze.log`, `full-operations-flutter-tests.log`, `full-operations-browser-result.json`, `full-operations-https.json`.

## Prepared artifacts and exact deployment approval scope

Core API patch: `.tools/full-operations-package/patch`, six compiled files; manifest `manifest.json`. It overlays the verified running API image only. It excludes private-beta code, auth restrictions, account allowlists and a maintenance cutover. Frontend build context and source manifest are in the same directory. No secrets or environment files are included.

Request approval to:

1. Reverify strict SSH, service health, disk, encrypted backup and rollback images.
2. Build the API patch and admin/web images on the existing Cloudzy VPS; verify them before switching services. Restart only API and web for this core change. Preserve all financial settings, balances, records, credentials, TOTP, permissions and customer access.
3. Perform safe post-deployment health/RBAC reads and interactive validation with the existing owner. Any password or TOTP is entered only into the local secure prompt. No real financial action.
4. Keep public Build 8011 and unpublished signed Build 8017 unchanged.

Rollback: preserve the original API/web images and compose references; restore those references if a critical compatibility or readiness check fails. No database restore, migration rerun or settings reset. The core change does not mutate database schema or financial policy.

### Separate explicit referral-pause decision

Live registration referral policy remains enabled at 0.1 USDT / REGISTRATION_OTP / MANUAL_RELEASE. Build 8017's Coming Soon UI alone does not pause old clients or server reward accrual. **No live reward policy was changed.**

Prepared optional `referral-patch` / `referral-manifest.json`: pause creation of invitations, attribution and new accrual consistently in API and engagement using `REFERRAL_PROGRAM_PAUSED=true`. Preserve existing records/balances and administrative review; normal signup with an old invitation still works without attribution. This optional patch excludes private-beta code. Its **9 isolated referral tests PASS**. It requires explicit policy/configuration approval and a narrowly scoped engagement restart; do not apply it as an incidental part of the core deployment.

## Android and release boundary

- Public 8011 SHA-256: `8fa26acc6c86fd18ce9aad40dbc85053f39d71f248aa792267e2eb23d339545b`.
- Signed candidate 8017 SHA-256, freshly matched: `d1a3731d1aaf2ba4dae45fd09711b69916393d4fd7ca786fc540d54ba5d3aecc`.
- Prior production certificate verification retained; no rebuild, resign or publication.
- Real-money execution and new APK publication remain subject to their separate approvals and unresolved operating/legal evidence. Legal operator/disclosures, applicable financial authorization and India-jurisdiction log evidence are not established by these engineering tests. No exemption is asserted and no Privacy Policy was written or edited.

## Files changed for this request

- Backend: `modules/admin/admin.module.ts`, `modules/owner/owner.module.ts`, `modules/owner/owner.service.ts`, `modules/manual/manual.module.ts`, `modules/manual/manual.service.ts`, `common/http-exception.filter.ts` (all under `backend/src`).
- Admin: `sensitive-bank-details.tsx`, `payout-receipt-upload.tsx`, `owner-order-details.tsx`, `owner-operations.tsx`, `manual-operations.tsx`, `operations.tsx`, `admin-inbox.tsx` (under `admin/src/components`); `admin/src/lib/admin-access.ts`; `admin/src/app/api/operations/[...path]/route.ts`.
- Tests: `backend/test/manual.test.mjs`, `backend/test/owner-console.test.mjs`, `admin/test/full-operations.test.tsx`, `admin/test/master-features.test.tsx`, `admin/test/admin-access.test.tsx`.
- Local-only preparation/testing helpers and manifests under `.tools/full-operations*` and `.tools/prepare-full-operations*`; this document.

Automatic approval review rejected exporting the deployed compiled application code to the local workspace. No production code export occurred. Preparation proceeded using the existing local source and isolated tests; that rejected export is not a deployment prerequisite.

## Approved core deployment result

The user approved **core operations deployment**. Only the six-file API overlay and tested admin/web image were deployed on 12 October 2026. The optional referral pause was not approved or deployed.

- API image: `sha256:3926cf306004f0a50f55ba4797feb7e2232bd0a8c39669895d056cfeb1b4d317`.
- Admin/web image: `sha256:bf374a367c7a411320638bdfd51dbbf9fd7c49251e7d73aeeb2fea7055ae19b7`.
- Both candidates passed verification before cutover. API imports and all six file hashes matched; the web image passed isolated startup with no production network connection.
- Current API/web healthy. PostgreSQL and Redis healthy; engagement remains running. Their original container IDs are unchanged. No API errors were observed in the post-switch sample.
- Encrypted backup was reverified before cutover: checksum, root-only access, authenticated decryption and complete pg_restore parse passed. No production restore.
- Before/after digests match for all 21 migrations, users, banks, wallets, ledger accounts/journals/entries, deposits, manual submissions, orders, payouts, private evidence, owner credentials/roles and production settings. No production financial write was performed.
- Runtime configuration hash unchanged. NORMAL access, maintenance OFF, manual submission enabled, financial automation disabled and existing execution gates closed. No private-beta configuration or synthetic exception enabled. Referral policy remains unchanged.
- Website, admin and download HTTPS 200. Anonymous admin/API access returns 401. Public APK was downloaded and its SHA-256 exactly matches Build 8011. Candidate Build 8017 hash also remains unchanged.
- Disk space after image build: approximately 214.94 GiB free, above the reserve.

Recovery artifacts are root-only on the VPS at `/srv/dtexchange/core-operations-20261012`. The prior API/web images are tagged `before-core-20261012`, immutable IDs recorded, original Compose and container configurations preserved, and `rollback-core.sh` restores only the previous API/web references without a migration or database restore. Current Compose refers explicitly to the tested `core-20261012` images. Use the verified images with `--no-build`; do not implicitly rebuild unrelated staged source.

Safe local evidence: `.tools/full-operations-deployed.json`, `.tools/full-operations-host-before.json`, `.tools/full-operations-host-after.json`, `.tools/full-operations-owner-before.json`, `.tools/full-operations-owner-after.json`, `.tools/full-operations-public-after.json`.

The first interactive owner attempt returned HTTP 401 before session issuance. The login implementation hash matches the previous production image; the account is active, credentials/TOTP remain present and the VPS clock is NTP-synchronized. The response intentionally does not distinguish password from TOTP rejection. No reset or bypass was performed. The secure validation helper now requests a fresh code only after the live form has loaded. A successful live login and module-read result must be recorded before claiming interactive owner acceptance.

### Final live owner acceptance — passed

Existing owner authentication, TOTP, Secure/HttpOnly/SameSite Strict cookie, logout, subsequent login and final logout passed. Existing credentials and roles were reused. Two UI test harness issues (waiting for bank data and an ambiguous Sign out selector) were corrected locally; no further application deployment was required. Completed module results were preserved between authenticated validation sessions.

- All 24 requested operational endpoint reads returned HTTP 200: Dashboard, Users, Banks, Wallets, Deposits, Manual Deposits, Orders, Manual Payouts, Reconciliation, Rates, Deposit Settings, Sell Settings, Deposit Wallet, Referrals, Referral Settings, Website Settings, App Settings, Maintenance, Notifications, Support, Audit, Health, Android Releases and Admin/Permissions.
- Existing dedicated synthetic user details returned successfully; bank numbers remain masked by default. New reveal controls rendered on the live Bank Accounts page. Reveal/hide/fresh-MFA behavior itself was exercised against isolated synthetic fixtures, not real customer bank details.
- Existing synthetic deposit proof was retrieved through authenticated private access; its content hash matched, and anonymous access was denied. Full payout receipt upload/preview/download remains covered by the isolated synthetic end-to-end tests, with no production payment confirmation.
- Updated core pages (Users, Banks, Sell Orders, Manual Payouts and Notifications) passed authenticated live checks at widths 360, 768 and 1440 with no horizontal page overflow. No sign-in form or permission-denied regression appeared in the authenticated core pages.
- Maintenance and referral policy remained unchanged. No financial, settings or publication writes occurred during validation.

Evidence: `.tools/full-operations-owner-live-result.json` and `.tools/full-operations-financial-final.json`. Production financial/configuration tables and role-grant digests remained unchanged after read-only validation. The legitimate TOTP replay counter is intentionally excluded from the final unchanged-record comparison.

Remaining boundaries: financial execution gates stay closed; the separate referral-pause proposal remains undeployed; public Build 8011 is unchanged and signed Build 8017 remains unpublished. Legal/operator/financial-authorization and Indian-jurisdiction logging evidence described above remain unresolved. No legal or financial-compliance completion is claimed.

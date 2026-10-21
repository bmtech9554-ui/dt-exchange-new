# Standard admin provisioning repair — 2026-10-07

## Observed committed state before and after repair

Admin rows: 0. Password credentials committed: 0. TOTP enrollments committed: 0. Admin-role assignments: none. Provision/login audit records: none. Admin sessions: 0. Login and safe-read validation did not complete.

The former helper emitted only a generic failure, so its exact original exception was not retained. A confirmed deterministic provisioning blocker was identified: the production migration-only installation omitted the reference-seed operations role and orders.read permission. The official provisioner rolls back when its role grant returns no row. Module-import preflight independently passed; no credentials or TOTP were used during diagnosis.

Applied new 010_standard_operations_role.sql after a fresh encrypted backup and checksum validation, through the official migration runner. No prior migration amended. This adds only the canonical operations role and four definitions/grants: orders.read, deposits.read, reviews.read, reviews.acknowledge. No financial permissions, super-admin grants, user rows or credential changes. Post-repair verification: exactly four grants, ten migrations, zero admins/sessions.

193 backend tests passed, including migration-only setup, exact grants, repeated-migration idempotency and zero-user creation. Helper failures now preserve nonsecret stage/reason codes only. A new credential prompt is required because prior in-memory credentials and unenrolled TOTP secret were discarded. No provisioning rerun was performed during diagnosis or migration.

## TOTP validation investigation

Latest failure: ADMIN_SETUP_STOPPED stage=TOTP_VALIDATION reason=TOTP_NOT_CONFIRMED. This check precedes the official provisioning script. Read-only production inspection confirmed zero admin users, password credentials, TOTP enrollments, role assignments and sessions. No partial account to repair; failed enrollment was never persisted.

VPS NTP active and synchronized, UTC timezone; timesync reported +65.722 ms offset. Host and API container both reported 2026-10-06T23:05:36Z (2026-10-07 in India). Deployed TOTP function passed all six RFC 6238 SHA1 time vectors, truncated to six digits. No acceptance-window or authentication changes made. The submitted code mismatch is confirmed; phone enrollment/settings/time cannot be determined from server evidence.

Closed the previous enrollment PowerShell process to discard its in-memory failed enrollment. Replacement prompt generates a fresh random secret and instructs the user to discard the failed authenticator entry, enable automatic phone time, use SHA1/time-based/6-digit/30-second settings and submit a fresh code. Secret/code remain private terminal input/output only. No SMS, financial action or permission expansion.

Repeated TOTP failure investigation: production inspection again found zero admin users, password hashes, TOTP ciphertexts, assignments and sessions. Operations role exists. UTC host/container agree; NTP synchronized, reported offset +65.722ms; deployed validator import measured 1.38 seconds. No persisted enrollment or partial account exists. Prior code/key were not retained, so retrospective differentiation of phone time versus wrong enrollment/code is not possible.

Added hidden setup-key confirmation to the private local prompt and diagnostic-only checks for nearby out-of-window TOTP codes. Out-of-window codes remain rejected; ambiguous matches are explicitly labeled candidates. Six synthetic checks passed: three accepted window steps, two rejected time-offset candidates, one rejected unmatched code. Prompt syntax passed. Updated only the protected provisioning helper on VPS, not application authentication. Previous prompt closed; replacement creates a fresh random key. No SMS, account mutation, financial action or RBAC expansion during investigation.

## Exposed enrollment discarded; URI enrollment replaces key retyping

Latest local status: AUTHENTICATOR_ENROLLMENT / RuntimeException, before the SSH provisioning stage. Closed the old prompt. Fresh production query confirms admins=0, password credentials=0, TOTP enrollments=0, assignments=0, sessions=0; operations role exists. The exposed secret was never persisted, so no database revocation or account repair was necessary. It will not be reused.

The removed key-confirmation branch explicitly threw RuntimeException on a retyped-key mismatch; a synthetic mismatch reproduces that exception type. The prior status omitted line/message, so the exact historical exception cannot be established conclusively. Do not represent the likely mismatch as proven. Added only safe script-line diagnostics (no exception messages or source text).

Removed setup-key retyping and raw-key display. New enrollment generates fresh randomness and displays an otpauth URI exclusively in the local terminal, with SHA1 / six digits / thirty seconds. URI is not written to files, logs or chat. URI construction/label/secret/settings tests and prompt syntax passed. The next enrollment input after URI display is only the hidden current authenticator code. No role expansion, SMS, financial actions or account creation during inspection.

## Confirmed official provisioning failure and repair

PostgreSQL logged audit_logs_actor_type_check at 2026-10-06 23:26:48.058 UTC. The official provisioner inserted actor_type='system', while the applied schema permits only user/admin/service. This rejected the audit insert and rolled back the entire account transaction. State inspection: zero admins, password credentials, TOTP enrollments, role assignments, sessions and admin.provisioned audits. No partial record or duplicate to repair. API container logs had no ERROR lines in the inspected two-hour window; provisioning ran as a separate CLI process, whose catch discarded the exception. PostgreSQL provides the concrete failure evidence.

All ten migration files match their applied checksums. Operations exists with only its four canonical grants. Independently exercised the helper's connection construction: database dt_exchange, role dt_owner, TLS true, API container NODE_ENV=production. No migration/dependency/role mismatch found.

Changed the official provisioner's audit actor from system to service, retaining secure-provisioner attribution. No applied migration or grants changed. New isolated test executes the real CLI body against PGlite with real password hashing/encryption; verifies account/TOTP/password/operations/audit commit and duplicate rollback without extra records. All 194 backend tests pass. Production credentials were not used in tests or retained. New enrollment is permitted only after the corrected script is deployed and readiness verified.

Deployment verification: rebuilt API image from corrected source, recreated only API service, container script checksum matches host source, valid service audit actor confirmed, readiness HTTP 200, admin count still zero. Manual flags true and automation flags false. One fresh secure enrollment prompt opened after verification. Build also reported three dependency audit findings (two high, one critical); dependency remediation was not included in this narrowly scoped provisioning repair.

## Existing admin login proxy repair

Confirmed one active admin, one password credential, one encrypted TOTP enrollment, one operations assignment; no sessions, no consumed TOTP step, one provisioning audit and no login audit. No account mutation, reset or duplicate provisioning was performed.

Credential-free reproduction: legitimate admin Origin was rejected HTTP 403 (Invalid origin) by Next.js BFF before NestJS. The old comparison used the internally reconstructed request URL behind TLS termination. Added server-configured DT_ADMIN_ORIGIN=https://admin.dtexchange.app and exact origin validation; production fails closed for missing/insecure/invalid configuration and does not trust forwarded headers. Existing Secure/HttpOnly/SameSite=Strict cookie policy unchanged.

37 admin tests and TypeScript check passed, production Next build passed. Recreated web service only. Production tests: legitimate-origin empty login now 400 (DTO validation), untrusted origin 403, API CORS matches official admin origin, website/admin/API readiness 200. Login-only private terminal prepared for existing email/password/current TOTP; performs read-only requests, prints status codes only, checks session cookie flags, then logs out. No provisioning, grants or SMS calls exist in this helper. Actual credential/TOTP/session validation remains pending user input. Existing STANDARD OPERATIONS grants remain orders.read, deposits.read, reviews.read, reviews.acknowledge; more privileged pages may return 403 intentionally.

# Master implementation — Build 8015 readiness

Checked 9 October 2026 (India time). Status: **BACKEND/WEB/WORKER DEPLOYED — BUILD 8016 PRIVATE CANDIDATE VERIFIED; PHYSICAL PAYOUT-RECEIPT CHECK PENDING**.

## Current cutover result — 9 October 2026

This section supersedes the historical stopped-attempt notes below. The approved
cutover has applied migrations017–021 and deployed the pinned candidate API,
engagement worker and web images. Public Build8011 remains unchanged; Build8015
and legal drafts remain unpublished. A genuine mobile wording defect subsequently
required private candidate Build8016; the original signed8015 is preserved unchanged.

The stdin correction first exposed a separate setup error: the helper inherited
the restricted `dt_api` database login. PostgreSQL rejected its initial
`CREATE TABLE IF NOT EXISTS schema_migrations` with42501 before any migration.
The corrected one-shot helper uses the existing `dt_owner` migration identity,
over verified TLS, as OS UID1000. Credentials travel only in process memory/stdin.
The API/worker keep the restricted runtime login and no schema-create privilege.

New object access is restricted to the operations actually used by the approved
features: USAGE on the two new sequences; SELECT/INSERT on referral entries,
referral releases and event notifications; UPDATE(id) on immutable referral
entries solely to permit row locking; SELECT/INSERT/DELETE on notification read
markers. Immutable triggers reject reward mutation. No database-owner, default
privilege, administrator-role-management or schema-creation grant was added to
the runtime account. An isolated PostgreSQL test exercised these exact grants,
OTP-eligible reward idempotency, notification read/unread and forbidden writes.
The one-shot migration and grant rerun skipped applied migrations safely.

Fresh backup before the successful migration:
`/srv/dtexchange/backups/dt-20261009T061523Z.dump.age`.
SHA-256: `cd1fe7e3fd9e7fe37aedd274870e1cdf39e4ebde06178bd5fb69a0a5e6846cdd`.
Encrypted checksum, decryption and pg_restore readability passed; the previous
isolated two-restore rehearsal remains valid. Worker rollback archive/config and
isolated startup evidence were checked before this cutover.

All21 production migration checksums match the pinned image. Six existing users
have unique public IDs beginning at1000; three key constraints and nine triggers
are enabled; no invalid index or ledger integrity issue exists. The two approved
manual bank accounts are Available; the synthetic bank remains non-payable.
Existing row hashes in14 critical tables confirm preserved users, credentials,
roles, bank data (excluding the approved availability metadata), financial
records and append-only audit history. The financial-settings digest is unchanged.

API, PostgreSQL, Redis and engagement heartbeat are healthy. An immediate
post-Nginx-reload `/invite` check briefly returned404 and stopped the script;
repeated read-only checks subsequently returned200 for invite and both legal
routes. The remaining source synchronization was completed without rerunning
migrations or restarting services. The original stop evidence is retained.

The existing owner password/TOTP and secure session passed live validation.
The first validation script triggered the unchanged Nginx rate limit by repeating
access discovery; only the test pacing was corrected. The next run confirmed all
24 module reads, public IDs and private proof access with anonymous denial. The
approved0.1USDT registration+OTP policy was activated through its audited owner
endpoint; no reward release or wallet credit occurred. All18 authenticated responsive
checks passed (six updated modules at360/768/1440 pixels). Samsung8015 maintenance
ON, blocking screen, Telegram Support, Retry, OFF and normal-flow recovery passed.
The validation script then stopped because it incorrectly expected private audit
payloads in the intentionally redacted audit listing. Only that test assertion was
corrected. A separate read-only production check confirmed both ON/OFF audit rows,
maintenance OFF and zero active validation sessions; no credential reset was needed.

There is no existing payout receipt attached to a production test payout, so a
physical History receipt-download check cannot be claimed from production data.
The isolated implementation tests cover ownership and secure receipt access.
Do not create a real payout just to populate this test.

### Final deployed checks and Build8016 — 12:34 IST

- All21 migration checksums match. API/PostgreSQL/Redis are healthy; engagement
  heartbeat and queue readiness pass. No migration was rerun during final checks.
- Final read-only row fingerprints preserve existing records in13 tables including
  every financial table, banks, users, role assignments and append-only audit rows.
  The original14-table check also verified admin credentials before authentication;
  later `last_totp_step` changes are expected replay protection, not a credential reset.
- Production financial-settings digest remains
  `eef37fbd8e35d85bb875b2cea19119c76651db3b14a6a512dd93a8813c5b0182`.
  Synthetic access, automatic blockchain credit and automatic payout remain OFF.
  Manual review/payout modes remain ON; transaction/payout execution gates stay OFF.
- The deployed environment had overridden the tested referral invite URL with the
  website root. Only this public URL was corrected to `https://dtexchange.app/invite`.
  The previous environment was encrypted and verified on the VPS; API/engagement
  were restarted using the same pinned images. Phone referral links now match.
- The Add Bank form still said “Sandbox verification” in production. The only new
  Flutter behavior change replaces that sentence with accurate self-declared/manual
  wording. Preview language, validation, financial rules and navigation are unchanged.
  Two widget regressions were added; Flutter analyze passed and all388 tests passed.
- Build8016 uses the existing production certificate, is non-debuggable and uses
  `https://api.dtexchange.app/api/v1`. Signature and copied-file SHA-256 passed.
  It installed as an update on Samsung without uninstalling; session/data survived.
- Physical8016 checks: Home₹103 and funding text, graph animation after navigation
  (1269 changed chart pixels), User ID1000, approved0.1USDT referral policy/invite
  link, separate referral balance implementation, Wallet, History, unavailable
  synthetic bank, corrected Add Bank text/withdrawal note, Deposit address/form,
  zero deposit fee, TxID/proof controls, Sell screen, support@dtexchange and
  Light/Dark/System controls. Original Light and screen-awake settings restored.
- An8015 Deposit screen stalled during validation. The deployed configuration
  reader returned valid data in8ms; a fresh8016 process loaded the screen and form
  correctly. No backend gate was weakened and no speculative loading fix was added.
- Biometric enrollment/restart and maintenance ON/OFF were physically verified
  on8015;8016 retained the enabled setting. Those implementations are unchanged.
  No new password login, OTP send, bank write, deposit, order or payout was performed.
- The initial8016 Wallet snapshot captured the previous tab during transition;
  the settled Wallet capture confirms the correct screen and zero balances.

Build8016 (private test candidate):

| Metadata | Verified value |
| --- | --- |
| Version/build | 1.0.0 / 8016 |
| File size | 60,367,418 bytes |
| SHA-256 | `1f83fbf061c6bf39e352930f988beb88bf987b03eb28daee49b83aef1e24d4ad` |
| Certificate SHA-256 | `475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c` |
| Local copy | `C:\Users\Ashik\Downloads\DTExchange-release.apk` |
| Archive | `mobile/build/verified-releases/8016/app-release.apk` |
| Publication | Not approved; not published |

Final evidence: `.tools/master-final-production-result.json`,
`.tools/master-postcutover-readonly-result.json`,
`.tools/master-cutover-owner-result.json` (retains the historical assertion stop),
`.tools/master-maintenance-audit-result.json` (independent corroboration),
`.tools/master-device/master-8016-*` and APK verification metadata.
Backend238/admin51 tests, typechecks and production web build passed for the
unchanged deployed images; the additional isolated runtime-grant test passed.

**Remaining completion gap:** no production test payout has a receipt attached,
so physical History receipt preview/download is unverified. Private ownership,
file validation and download behavior have automated coverage. No financial
record was invented or changed to populate the test. Full mobile publication
readiness is not claimed. Separate explicit approval remains required to replace
public8011; do not request or execute publication as though all tests passed.

Final public metadata still identifies8011, SHA-256
`8fa26acc6c86fd18ce9aad40dbc85053f39d71f248aa792267e2eb23d339545b`,
at `https://dtexchange.app/downloads/DTExchange.apk`. Website, download, admin,
invite and both legal routes returned HTTPS200. Legal routes explicitly state
“This document is not yet published.” The first final-audit matcher expected
“not published”; it was corrected to the actual existing message and passed.

## Approved recovery-resume attempt — stopped before migrations, 11:26 IST

Fresh explicit master cutover approval was received. Strict SSH, live health,
recovered runtime/configuration and isolated startup evidence, existing backup
recovery evidence, migration history and pinned artifact checks all passed.
The guarded cutover created and verified a fresh encrypted backup, then stopped
before running any SQL because the migration-helper bind mount was unreadable by
the non-root `node` process:

`EACCES: permission denied, open '/run/master-migrate.cjs'`.

The helper upload applied root ownership and mode0700 to all orchestration files;
that mode is unsuitable for a script bind-mounted into the UID1000 container.
This was an orchestration-file permission error, not a schema or database error.
The helper process failed before loading its source or opening a DB connection.

Post-stop read-only verification confirms production remains at migrations001–016,
all14critical tables preserve existing records, all five service IDs/start times
and zero restart counts are unchanged, health is ready, financial settings match,
and public Build8011 remains available. Build8015 is unpublished. Exit code1 and
the `.started` guard/log are retained as `master-recovery-resume-8015.*` on the VPS.

Fresh backup: `/srv/dtexchange/backups/dt-20261009T055628Z.dump.age`.
SHA-256: `ee72037352acd9d7429a9ba1207e2d14ba5a4409a6c327da371580eff907eb0a`.
Checksum, decryption and archive readability were independently reverified.

Local-only correction prepared: stream the helper into `node -` using Compose
`run -T`, preserving the non-root user and avoiding any permission broadening.
A new guarded resume wrapper preserves both failed-attempt guards and asserts
the 16-migration baseline. No repair/retry has been deployed after the failure.
The user's explicit critical-stop requirement is in effect; obtain approval for
this narrow orchestration fix/resume before further production changes.

## Worker rollback recovery — verified, fresh cutover approval required

Final isolated startup rehearsal passed at 11:17 IST on 9 October. The recovered
runtime completed two dispatch jobs with healthy heartbeats and zero failures on
each disposable schema (001–016 and 001–021). Only loopback was available, no
production secrets/data were used, and all ephemeral containers were removed.
Production configuration and container lifetimes remained unchanged. The local
rollback preflight now also requires this recorded startup evidence.

The missing-image blocker was investigated without stopping/restarting services.
Docker's old image registration is absent; the retained full OCI index also lacks
a build-provenance blob. With the user's explicit alternative-recovery approval,
the exact original AMD64 runtime manifest/configuration and all 11 layers were
restored as `dtexchange-api:engagement-runtime-rollback-20261009`, image ID
`sha256:db376a18875f31e48ca028ee3d61d6af53d8994e4e8c1a283679fe29ff3c01cd`.
This does not claim the full original image index was recovered.

The OCI archive passed hash checks and Docker load/inspect. Actual running worker
configuration and required mounts were preserved in an encrypted, root-only VPS
artifact; decryption and Compose validation passed. The original worker remains
unchanged with zero restarts. API/DB/Redis readiness, existing records, encrypted
database backup, pending migrations, pinned candidate images and Build8015 hashes
were rechecked. Public8011 remains available and production remains unmigrated.

The local resume/preflight helpers now use this separately approved runtime and
captured configuration, retain the previous guard, and passed read-only/syntax
checks. They have not been dispatched. Fresh cutover approval is required.
See [recovery identities, limitations and procedure](engagement-rollback-recovery-20261009.md).

## Approved cutover attempt — stopped safely, 9 October 2026

The user explicitly approved migrations 017–021 and the pinned master cutover,
excluding APK/legal publication. After a transient SSH interruption, fresh strict
connections and migration/financial checks passed. The one-time approved helper
was dispatched, but it stopped **before migrations and before service restart**.

Exact failure: Docker could not tag the running engagement worker's original image
`sha256:019a012ccb614992e42501d059635983525546ffcb8f8bb41415b5e2eef7a399`
because that identifier is not resolvable in Docker's registered image store. The container itself remains
running and healthy. No exact worker rollback artifact could be created, so the
cutover must not be blindly rerun. Its remote `.started` guard and exit code 1 are
retained under `/srv/dtexchange/master-approved-8015.*`.

A new encrypted backup was created and checksum/readability verified:
`/srv/dtexchange/backups/dt-20261009T045228Z.dump.age` (10:22 IST).

Post-stop verification confirmed:

- Production still has migrations 001–016 only. 017–021 remain pending.
- Existing records, balances, admin credentials/roles and audit rows passed
  preservation comparison across 14 critical tables.
- Financial settings match the baseline; all automatic credit/payout and existing
  transaction/payout execution gates remain disabled.
- API/database/Redis/workers remain ready; website/admin HTTPS return 200.
- Public Build8011 remains available. Build8015 remains private/unpublished.
- Referral activation, new user IDs, new owner capabilities and notifications
  have not been enabled in production; authenticated post-deployment checks have
  not begun. No owner credential prompt was opened and no transactions occurred.

The subsequent recovery described above resolves the rollback prerequisite using
the separately approved original runtime artifact. It does not authorize resuming
the cutover. Do not delete guard files or rerun migrations blindly.

## Fresh prerequisite verification — 9 October 2026

At the user's renewed request, separate strict host-checked SSH connections passed.
The live API, database, Redis and workers were healthy. Production still has exactly
001–016 applied with matching checksums; 017–021 remain absent. Financial settings
match the prior baseline, synthetic access remains disabled, and the existing owner
and public Build 8011 remain in place. Candidate source archive, container image
IDs, signed APK and Downloads copy match the tested identifiers below.

Fresh encrypted backup created at **02:09 IST on 9 October 2026**:
`/srv/dtexchange/backups/dt-20261008T203907Z.dump.age`.

SHA-256: `0ea84b618b214a5468882f0276cf516899a7640aff16981dbb4b215ed69c9f9f`.

It passed two isolated restorations, candidate migrations/rerun validation,
preservation of 71 existing tables, six public-ID backfills and zero ledger
integrity issues. No production migration ran. Temporary recovery containers and
password files were removed; no recovery key left the VPS. Evidence is in
`.tools/master-precutover-restore-result.json` and
`/srv/dtexchange/rehearsals/precutover-8015-20261009/report.json`.

The prepared local cutover helper now pins tested source/image hashes and saves
the live worker's exact image independently from the API for rollback. Syntax
validation passed without execution. Current images and Nginx fingerprint are
recorded in `.tools/master-cutover-rollback-baseline.log`.

**All prerequisites passed. Explicit cutover approval is still required.**
Build 8015 publication and legal publication are excluded from that approval.

The current request authorizes implementation, tests, staging, an encrypted backup
and isolated recovery rehearsal, existing-identity signing, and Samsung installation.
It does not authorize production migrations, policy activation, service cutover,
or APK publication. Build 8011 remains publicly available.

## Feature audit

The latest request contains 14 feature groups. All 14 have local implementation;
this is not a claim that the new server features are deployed or live-validated.

| Feature group | Implementation and evidence | Remaining live gate |
| --- | --- | --- |
| Public user IDs | Migration 017; database sequence starts at 1000, deterministic existing-user backfill, unique/immutable IDs, UUID relations retained; concurrency tests and real restored-data rehearsal | Apply approved migration; inspect app/admin IDs |
| Registration + OTP referral qualification | Backend auth hook, immutable attribution and policy snapshot, 0.1 USDT configured as decimal string; replay/self-referral/risk/synthetic exclusions tested | Approved policy activation; authenticated reads |
| Separate rewards / manual release | Append-only reward entries and releases; accrual never credits the wallet; permission and execution controls required for a balanced manual release; legacy worker skips registration rewards | No live release test: financial execution stays disabled |
| Manual bank eligibility | Self-declared availability is distinct from verification; approved pending manual banks backfilled; synthetic banks permanently non-payable; automatic payout still requires verification | Migration 018 and authenticated eligibility reads |
| Biometric login | OS biometrics + secure persisted preference, protected session refresh, cancellation/unsupported/expired-session tests; existing setting retained after Samsung update | No new implementation blocker |
| Light / Dark / System | Persisted device preference; semantic contrast correction; navy-on-white QR canvas; layout and contrast tests; all three modes checked on Samsung | No new implementation blocker |
| Privacy / Terms | Backend published-document gate, app links and web routes, local drafts. Samsung shows the unpublished state truthfully | Final operator/contact/legal facts and review; publication remains prohibited |
| Support | Telegram @dtexchange and ticket UI retained; matching CTA sizing, live Samsung screen inspected; backend authorization tested | Candidate authenticated responsive check after cutover |
| Payout proof / History download | Private upload validation, authenticated owner access, receipt image preview and user download; existing paid-history metadata retained; backend/widget tests | Read-only live receipt check if an authorized existing receipt exists; never create a real payout for testing |
| Owner management | Existing operational modules preserved; safe bank reveal, disable and retention-safe closure capabilities; permission tests | Migration 021 and owner read-only checks |
| Deposit / withdrawal notifications | Event-driven user notifications preserved; admin inbox adds deduplicated deposit/order/payout/support events, per-admin read state and permission filtering | Migration 020 and owner inbox reads |
| Referral administration | Policy editing with reason/confirmation/audit, history, explicit manual release. This audit restored rejection and gated review/release controls by returned capabilities | Candidate owner session reads; no real reward release |
| User management | Search, filters, sort, pagination, full details, section pagination, audited safe edit/status/closure; sensitive credential fields excluded | Candidate owner session reads |
| Deposit / payout workflows | Existing manual review, TxID deduplication, private evidence, UTR/receipt and immutable financial records preserved; complete backend regression suite passes | No production financial-record mutation during validation |

## Verification evidence

- Backend: **238 passed**, zero failed (`.tools/master-final-backend.log`).
- TypeScript: backend and admin typechecks passed (`.tools/master-final-typecheck.log`).
- Admin unit/regression tests: **51 passed**, zero failed (`.tools/master-final-admin.log`).
- Additional browser fixtures: **18 responsive checks** at 360/768/1440 pixels for
  users/details/edit, banks, referrals, referral settings, notifications and support.
  Rejection, capability visibility, notification read state, retry and authenticated
  permission-denied state passed. Every operations response was intercepted with
  synthetic data; zero production requests (`.tools/master-admin-fixtures-result.json`).
- Prior real PostgreSQL concurrency/referral suite: **6 passed**; retained evidence
  in `.tools/master-real-postgres.log`. This is prior evidence, not a fresh rerun.
- Flutter analyze: **no issues**. Flutter tests: **386 passed**.
- Canonical design-token consistency check passed; tokens unchanged this turn.
- Admin/website production build and candidate API/web Docker builds passed.
- Local checkout has no `.git` directory. The reported 94 modified files cannot be
  independently presented as a Git diff; no commit or push was made.

## Database and recovery readiness

Production was inspected through strict host-verified SSH. It still has 16 applied
migrations, six users and one active owner. PostgreSQL, Redis, API and workers report
ready. The temporary synthetic access window is disabled.

Fresh encrypted backup (retained on VPS):

`/srv/dtexchange/backups/dt-20261008T200212Z.dump.age`

SHA-256: `64aac6927c680e6847edbc065d681f864841554e00d073da1d6ab57f9ddc4401`

Recovery evidence: `.tools/master-recovery-result.json` and
`/srv/dtexchange/rehearsals/master-20261009-v4/report.json`.

The backup was checksum-verified and decrypted as a stream into two disposable
PostgreSQL 16 databases with no external network, no published port and temporary
in-memory database storage. No decrypted dump was saved and no recovery key was
copied off-server. Migrations 017–021 ran on one clone only. The audit confirmed:

- All existing rows across 71 tables were retained, with original financial data.
- Six public IDs were backfilled from 1000 in registration order.
- Existing optimistic-lock version triggers incremented exactly as expected for
  the user and eligible-bank backfills; these metadata increments were checked
  separately, not ignored as arbitrary changes.
- The official migration runner's second run made no changes. Applied checksums,
  advisory lock, per-file transactions and lock/statement timeouts remain intact.
- Ledger integrity issues: zero. Referral policy remained disabled after migration.
- A second clean restoration matched the pre-migration snapshot and versions.
- The owned rehearsal containers and temporary passwords were removed. Production
  records were not modified. Initial audit-helper failures were repaired and the
  final rehearsal passed; no SQL migration needed changing.

Recovery procedure after a future approved cutover:

1. Stop the cutover on failed preflight/health checks; retain encrypted evidence.
2. For application failure, restore the captured API/web image tags and Nginx
   configuration. Keep additive schema/data intact; do not reverse migrations.
3. Verify health, disabled automation, financial configuration digest, and public
   APK metadata. Existing financial records must remain available.
4. If database restoration is actually necessary, obtain separate destructive-
   recovery approval. Verify the encrypted backup checksum, restore into a new
   isolated database first using the tested streaming procedure, verify counts,
   credentials/session compatibility and ledger integrity, then plan an explicit
   database switchover. Never drop or reset the live database automatically.
5. Off-server recovery remains a separate approval: keep ciphertext and the
   decryption key in separate trust/storage locations; do not copy both together.

## Signed Android candidate

- Version: **1.0.0 / 8015**.
- APK: `C:\Users\Ashik\Downloads\DTExchange-release.apk`.
- Original: `mobile/build/app/outputs/flutter-apk/app-release.apk`.
- Size: **60,367,418 bytes**.
- SHA-256: `a7ba1c16d54457e9d8eae7787ca5bd1719d3567bdbb5e357de263d0081925e54`.
- Certificate SHA-256: `475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c`.
- Signature verified; matches the existing production identity; non-debuggable.
- Production API: `https://api.dtexchange.app/api/v1`.
- Installed on the authorized Samsung as an update, without uninstalling. Session
  and enabled biometric preference retained. Home shows ₹103; Light/Dark/System,
  Dark Wallet/History, deposit address/white QR, support and unpublished legal state
  were checked. Original Light preference and screen-awake setting were restored.
- Newly staged backend-dependent features require post-cutover physical checks.
  Do not label the full master physical validation complete before those checks.
- No APK publication or release-attestation publication has occurred.

## Immutable staging identifiers

- Source archive SHA-256:
  `272b2fbb47af2a069007114662724d2d1abe3e6e13ef06520a408aac94c0656b`.
- API candidate `dtexchange-api:master-8015`:
  `sha256:c275f02808ac628a938f9dcd20484b224d7bd35006b4ce150caf44dfb6ff8169`.
- Web candidate `dtexchange-web:master-8015`:
  `sha256:f885f219f0ac60414820708f88fe433366a4e33643265fbed865c5a861a7b50a`.
- Pre-cutover financial-settings digest (rates, fees, user limits, deposit
  policy/wallet and synthetic-window configuration):
  `eef37fbd8e35d85bb875b2cea19119c76651db3b14a6a512dd93a8813c5b0182`.

## Controlled deployment checklist — approval still required

Before executing: obtain approval for the exact migration/service/policy scope.
The staged cutover helper additionally requires its explicit approval marker.

1. Recheck image/source digests, current migration checksums, available capacity,
   financial settings and disabled synthetic window. Abort on unexpected drift.
2. Take a new encrypted pre-cutover backup; verify checksum and readable archive.
   Retain the completed isolated-restore evidence above.
3. Capture current image IDs/tags and Nginx/source configuration for rollback.
4. Apply only migrations 017–021 with the official checksum-protected runner.
5. Switch/restart only API, engagement worker and web to the pinned candidates.
   PostgreSQL/Redis data volumes, secrets, signing identity and current public APK
   remain untouched. Add only the staged invite/legal routing.
6. Verify database/Redis/worker/API readiness, admin authenticated reads and the
   unchanged financial digest. Preserve rate103, deposit100/fee0/daily20000/no
   monthly cap, sell5000/daily20000/monthly100000/fee0/60-second quotes.
7. If included in approval, use the existing audited owner flow to activate
   registration+OTP referral policy at 0.1 USDT, separate balance/manual release.
   Require the existing owner credentials only through the secure local terminal.
   This does not enable wallet-credit or payout execution.
8. Keep MANUAL_DEPOSIT_REVIEW=true and MANUAL_PAYOUT=true. Keep
   AUTOMATED_BLOCKCHAIN_CREDIT=false, AUTOMATED_PAYOUT=false,
   TRANSACTIONS_ENABLED=false and PAYOUTS_ENABLED=false.
9. Validate new owner/app reads, public IDs, referral summary, bank eligibility,
   inbox and legal gate. Use synthetic local tests for writes; do not create real
   orders, deposits, payouts, reward releases or OTP sends during validation.
10. Retain public Build8011 until a separate exact Build8015 publication approval
    and successful post-cutover physical checks. Legal documents stay unpublished.

Remaining gates: scoped production deployment/policy approval; owner credential
entry when authenticated candidate validation is possible; post-cutover Samsung
checks; separate public APK approval; confirmed legal operator/contact before
legal publication. No production completion claim is made.

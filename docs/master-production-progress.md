# Master production implementation — 9 October 2026

Scope: the user's master production request, extending the existing live system.
Build 8014 is a signed, unpublished Samsung test candidate. A later local dark-mode
contrast correction is not yet included in that APK. Public Build 8011 remains unchanged.

## Invariants

- Preserve UUID primary keys, existing accounts, signing identity and financial history.
- Additive migrations only, preceded by a verified encrypted production backup.
- Manual deposit review and manual payout stay enabled; automatic blockchain credit
  and automatic payout stay disabled. No real financial transaction during validation.
- Keep existing rate, fees and limits. No production change before local checks pass.
- Credentials and signing passwords are entered only through secure local prompts.

## Inspection findings

- Owner console, deposit reviews, release attestation, private proofs and maintenance
  already exist; audit and extend them rather than replacing them.
- Public user IDs currently expose UUIDs; numeric allocation/backfill is missing.
- Referral implementation uses INR rewards and a legacy identity verification gate.
- Bank additions currently enter manual verification.
- DeviceAuthenticator is only an interface; biometric settings are a preview screen.
- Theme is fixed to light. Connected legal and support routes already exist.

## Approved business rules

- Referral qualification is registration plus OTP. Rewards accrue separately in
  USDT and require manual release; qualification never credits the spendable wallet.
- Valid self-declared bank accounts may become immediately available for manual
  operations, including existing pending manual-review accounts. The user explicitly
  approved this control change. Never label these accounts independently verified.
  Automatic payout paths still require verification; synthetic banks stay non-payable.

## Local implementation checkpoint

- Additive migrations 017–021 cover numeric public IDs, self-declared manual banks,
  immutable referral rewards, permission-filtered admin event notifications and
  explicit owner bank-reveal/account-closure capabilities.
- OS biometrics, persistent theme selection, referral sharing/history and private
  payout-proof zoom/download are implemented locally in Flutter.
- 236 backend tests, 6 real PostgreSQL concurrency/referral tests, 51 admin tests
  and 386 Flutter tests passed. Flutter analysis and TypeScript checks are clean.
  Admin/website production build passed; final pagination adjustments passed
  14 focused owner tests and admin typecheck. Candidate API/web images are built.
- Build 8014 is signed with the existing production identity, verified non-debuggable,
  copied to Downloads and installed as an update on the authorized Samsung.
  SHA-256: 23665292464d46b165f0dbecaf7f87cbd2c18edb2f886c3124d86c81f93471cb.
- Samsung Home and saved-session recovery work. User confirmed biometric acceptance;
  the biometric preference remains enabled after restart.
- Physical Dark mode revealed low-contrast shared detail values, Home labels/icons,
  selected navigation icons and the QR scan surface. The local correction uses
  existing semantic colors, preserves bright action artwork, and keeps QR modules
  navy on white. Four new Light/Dark contrast tests and existing narrow/large-text
  layout tests pass; corrected renders were visually inspected.
- Build 8014 must not be published as the final candidate: the contrast correction
  still needs a new signed candidate and Samsung revalidation when release work resumes.
- Appearance was restored to System Default and haptic feedback to its original ON
  state after testing. The user-approved biometric preference remains enabled.
- The isolated PostgreSQL container and its two SSH tunnels were removed after tests.

## Legal publication gate

User confirmed brand DT Exchange, https://dtexchange.app and temporary contact
dtexchangeservice@gmail.com. Legal operator remains unconfirmed. Draft Privacy
Policy and Terms are saved under docs/final/legal and remain UNPUBLISHED.
Public routes render only explicitly published backend documents. Ask for final
operator and official contact confirmation before legal publication.

## Production cutover deferred by the user (superseded preparation scope below)

The user answered the explicit cutover question: **Keep changes staged for now.**
At that checkpoint, do not execute the prepared backup/migrations 017–021, service cutover, invite/legal
Nginx routes, referral activation, live owner validation writes, or APK publication.
API/web candidate images are staged only. There is no pending authorization to deploy.

A read-only VPS check on 9 October confirmed migration 016, no master cutover status
file, healthy API/database/Redis/worker readiness, six existing users and one active
owner. Manual review/payout remain true; automatic credit/payout, transactions,
payout execution and the temporary synthetic window remain false. Production
registration-referral policy is absent because migration 019 has not been applied.
Public APK remains unchanged. No real transaction or new SMS was performed.

## Release gates

Backend/admin/web tests and builds; Flutter analyze/tests; additive migration and
concurrency validation; backup verification; scoped deployment; existing-identity
release signing; Samsung validation; public hash/signature verification.

Status: staged at the user's request. Remaining gates are explicit cutover approval,
post-deployment owner/feature validation, signing and physical retest of the local
contrast correction, and separate release approval. Legal publication additionally
requires the actual legal operator and final official contact details.

## 9 October 2026 — final pre-deployment preparation

The latest user request explicitly authorized fresh encrypted backup/recovery
preparation, implementation completion, tests, signing and Samsung testing while
retaining the production cutover/publication approval gates. This supersedes the
older hold on backup preparation only; deployment is still not approved.

- Referral admin rejection was restored; release/review controls now follow
  backend capabilities. Read-only referral users cannot invoke either action.
- Final full results: 238 backend tests, 51 admin tests and 386 Flutter tests
  passed. Flutter analyze, backend/admin typecheck, token consistency and
  admin/website production build passed. Eighteen additional local synthetic
  browser checks passed at mobile/tablet/desktop sizes.
- Fresh encrypted backup was restored twice in isolated PostgreSQL containers.
  Migrations 017–021 and safe rerun passed on the clone, preserving 71 existing
  tables and backfilling six public IDs. Expected optimistic version increments
  were explicitly validated. Recovery containers/passwords were removed.
- Production remains at migration 016 with healthy API/database/Redis/workers,
  unchanged financial controls and a disabled synthetic window. No cutover occurred.
- Build 8015 was signed with the existing identity, verified non-debuggable,
  hash-checked in Downloads and installed on Samsung as an update. Session and
  biometric setting survived. Light/Dark/System and corrected Dark Home, Wallet,
  History, address/QR, support and unpublished legal state were checked. Light
  appearance and the original stay-awake setting were restored.
- New backend-dependent physical checks await approved deployment. Build 8011
  remains public; Build 8015 is a private candidate, not published.
- Candidate API/web images are built with distinct master-8015 tags; live image
  tags and services were not changed.

Full feature matrix, exact hashes, backup/restore evidence, limitations and the
controlled-cutover checklist: [Master release readiness](final/master-release-readiness-8015.md).

## Approved cutover — stopped before migrations

The user subsequently approved the exact master production cutover. The one-time
helper created and verified `/srv/dtexchange/backups/dt-20261009T045228Z.dump.age`,
then stopped while preparing rollback tags: the running engagement worker's old
image ID is unavailable in Docker's image store. The worker remains running.
No migration or service switch occurred. Per the user's stop-on-critical-failure
instruction, do not blindly rerun the guarded helper.

Fresh post-stop checks confirmed 16 migrations, unchanged financial settings,
14-table preservation of existing balances/records/admin credentials/audit rows,
healthy API/database/Redis/workers, website/admin HTTPS200 and public Build8011.
Build8015 and legal drafts are still unpublished. The scoped approval exists,
but exact worker recovery readiness must be repaired before a controlled resume.
See the readiness report for the precise error and remote checkpoint paths.
# 9 October 2026 — worker rollback recovery (no master cutover)

Read-only investigation found the original worker OCI index unregistered in
Docker and its build-provenance blob missing. The running container's exact
Linux/AMD64 manifest, configuration and all 11 runtime layers survived and passed
compressed/uncompressed hash verification. Following explicit user approval,
restored these original bytes under a separate rollback reference; no new build,
container snapshot, service restart or database migration occurred.

`dtexchange-api:engagement-runtime-rollback-20261009` now resolves to
`sha256:db376a18875f31e48ca028ee3d61d6af53d8994e4e8c1a283679fe29ff3c01cd`.
Docker load/inspect and archive verification passed. Running environment/mount
state is encrypted on the VPS and round-trip/Compose verified. The worker ID,
start time and zero restart count remain unchanged. Migrations017–021 remain
pending, financial records/settings unchanged, public8011 unchanged, private8015
hash verified. A prepared guarded resume helper awaits fresh cutover approval.
Full evidence: `docs/final/engagement-rollback-recovery-20261009.md`.

## 9 October 2026 — approved master backend deployed; private Build8016

This supersedes the stopped-attempt status above. Migrations017–021 were applied
with the existing database owner through a non-root one-shot helper. The API and
engagement worker retain restricted runtime access. Pinned API/worker/web images
are deployed and healthy. Fresh encrypted backup/recovery checks preceded rollout;
existing financial records and financial settings remain intact.

Owner password/TOTP, secure session,24 module reads,18 responsive checks and private
proof access passed. The0.1USDT registration+OTP policy is active, separately accounted
and manually released; no reward was released. Six users have public IDs1000–1005.
Two existing manual banks have approved self-declared availability; the synthetic
bank is non-payable. Notifications/referral safety passed isolated runtime tests.
Maintenance ON/OFF physically passed on Samsung8015 and both changes are audited;
maintenance is OFF, validation sessions revoked, synthetic exception disabled.

A production referral-link environment override was corrected to the existing
`/invite` page. A genuine stale “Sandbox verification” sentence in the production
Add Bank form required private Build8016. Same signing identity;8015 unchanged.
Flutter analyze and388 tests passed.8016 signature/non-debuggable/config/hash checks
passed, and Samsung updated without uninstalling. Home/graph, user ID, referrals,
bank forms, Deposit, Sell, Wallet, History, support and theme smoke checks passed.

The physical History payout-receipt download check remains unverified because no
existing test payout contains a receipt. No production financial record was created
to manufacture a result. Full mobile publication readiness is therefore not claimed.
Public8011 and unpublished legal drafts are unchanged;8015/8016 were not published.
Detailed results, limitations and hashes: `final/master-release-readiness-8015.md`.

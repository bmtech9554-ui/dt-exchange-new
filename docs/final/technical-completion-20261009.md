# DT Exchange technical work status — 9 October 2026

Internal engineering evidence only. This is not a legal document or a compliance
certification. Customer text, quotes, designs, legal drafts and signed APK bytes
were not changed. No production deployment or financial mutation was performed.

## Implemented locally in this task

- `backend/src/common/security-observation.ts` and the `main.ts` finish hook:
  structured internal admin/user login, OTP, session-refresh and access-rejection
  outcomes. No credential, body, URL, account identifier or IP is reflected.
  Existing responses, authorization, rate limits and TOTP remain unchanged.
- `backend/test/security-observation.test.mjs`: four focused regression tests.
- `deployment/cloudzy/logging/`: disabled archive/retrieval/monitoring package,
  real age encryption, content manifests, checksums, private spool permissions,
  exact-version cloud receipts, India-region/account checks, private bucket and
  retention checks, recovery with traversal/tamper defenses, read-only audit and
  aggregate monitoring queries, IAM template, systemd timers/services, preservation
  rotation and continuous TLS-forwarding templates, tests and operator runbook.

The backend event logger is **not deployed**. Storage transfers, bucket creation,
log rotation changes, service units, alerts and forwarding are **not activated**.
The user confirmed no India log storage currently exists. AWS S3 is a reference
adapter only; no provider was purchased or selected on the user's behalf.

## Tests and verified evidence

| Check | Actual result |
| --- | --- |
| Archive/recovery tests | 20 passed; actual age encryption/decryption; cloud responses mocked, no network or production data. |
| Backend build | TypeScript production compilation passed. |
| Focused backend regression | 87 passed: security event metadata, authentication, registration referrals, manual workflows, owner console. |
| Admin/website tests | 51 passed, including public site, admin permissions/origins, manual proof controls and master features. |
| Admin typecheck | Passed. |
| Flutter analyze | No issues, current unchanged mobile source. |
| Focused Flutter tests | 40 passed: payout proofs, biometrics, bank mode, maintenance and theme layouts/contrast. |
| Production frontend build | Prior successful build retained; deployed web image unchanged. No redundant frontend rebuild. |
| Samsung | ADB authorized, installed version 1.0.0 / 8016 confirmed. Prior physical acceptance retained; no new login/OTP/financial action or maintenance toggle. |
| Payout proof | Prior isolated real admin upload and Samsung History preview/zoom/native download/hash/access-control/error-retry evidence retained. No production payout fabricated. |
| Candidate APK | Hash and production certificate reverified; apksigner PASS; non-debuggable; production API configuration unchanged. No rebuild/resign. |

Initial local test attempts encountered sandbox loopback/process restrictions;
they were rerun with the required local execution permission and passed. No test
failure was hidden. A backup verifier initially used `pg_restore --list`, which
can close the pipe before age finishes; the corrected read-only check parsed the
entire dump to `/dev/null` and passed authenticated decryption without DB writes.

## Current live verification

Evidence: `.tools/technical-completion/` contains safe JSON/log outputs.

- Strict verified SSH works. API/web/PostgreSQL/Redis healthy; engagement heartbeat
  current. All running images inspectable. Nginx, fail2ban, rsyslog, backup and
  health timers active. Firewall active; clock reports synchronized.
- All 21 applied migration checksums valid, expected safeguards/triggers present,
  invalid indexes zero, ledger integrity issues zero. No migrations were run.
- Existing user, bank, role, ledger, deposit, order, payout, private-file and audit
  snapshot records remain. The previously investigated owner amendment to one
  mutable manual-deposit row remains the only historical baseline difference;
  this task did not amend it.
- IDs start at 1000; six users. Referral policy is enabled, REGISTRATION_OTP,
  reward `0.1`, MANUAL_RELEASE. Production reward entries/releases are zero;
  accounting, duplicate/self/referral-abuse and release tests use synthetic data.
- Two available self-declared bank records, one permanently non-payable synthetic
  fixture, zero synthetic eligibility violations. Bank approval safeguards intact.
- Existing owner credentials, roles and TOTP were not modified. Earlier live login
  with TOTP, secure cookies and 24 module reads remain the acceptance evidence for
  the unchanged deployed image. No fresh interactive admin login is claimed here.
- Existing owner acceptance covers dashboard/users/details/edit/banks/wallets,
  deposits/TxID/private proof/manual reviews, orders/manual payouts/reconciliation,
  referrals/settings, rate/deposit/sell/wallet controls, website/app/maintenance,
  notifications/support/audit/health/releases/permissions. Mutating financial cases
  were exercised only in isolated tests, not against real production records.
- Rate 103; deposit min 100, fee 0, daily 20,000, monthly uncapped; sell max 5,000,
  daily 20,000, monthly 100,000, fee 0%, quote 60 seconds. Settings digest unchanged:
  `eef37fbd8e35d85bb875b2cea19119c76651db3b14a6a512dd93a8813c5b0182`.
- Manual deposit review and manual payout true. Automatic blockchain credit and
  automatic payout false; transactions/payout execution gates remain false.
  Synthetic exception disabled. App/website/API maintenance off.
- HTTPS checks passed, including site/admin/download/legal routes. Public APK HEAD
  returns 200; server file hash/size and active metadata still match Build 8011.
- Latest encrypted backup checksum, private permissions, complete authenticated
  decryption and dump parsing passed. It was about nine hours old when inspected.
  Earlier isolated restore drill remains valid; no new database restore was run.
  Backup plus recovery key remain on VPS per instruction; no off-server transfer.
- Recovered worker runtime `sha256:db376a18875f31e48ca028ee3d61d6af53d8994e4e8c1a283679fe29ff3c01cd`
  is inspectable. Both rollback archive hashes verified; prior isolated startup
  against schemas 16 and 21 passed. This is the approved runtime recovery artifact,
  not a claim that missing original provenance was reconstructed.

## Technical control assessment

Authentication: OTP expiry/rate/attempt/single-use checks, password hashing, session
rotation and admin replay-resistant TOTP have tests. Existing user login history
and append-only admin audit are present; staged event metadata improves visibility
of failed admin/auth requests without changing the authentication decision.

Financial integrity: decimal/integer calculations, ledger balance constraints,
immutable journals, TxID uniqueness, permanent idempotency, synthetic non-creditable
deposits/non-payable banks, manual approval/receipt permissions and disabled
automation remain verified. No real order/payout was submitted for this audit.

Referral abuse: self/duplicate attribution, shared-device/bank/risk checks, separate
reward accounting and manual release safeguards are tested. Risk flags/manual
review are monitoring capabilities, not a complete AML/customer-due-diligence or
STR program. No sanctions screening provider or regulatory approval is invented.

Sensitive information: bank fields and private proof use authenticated encryption;
proof ownership/admin permissions and anonymous/cross-user rejection are tested.
Audit records persist in PostgreSQL and encrypted backups. That alone does not
prove five-year reconstructable records or complete ICT retention in India.

## Remaining logging/monitoring activation gates

1. India storage/collector account, private access credentials, verified location
   and retention controls; user confirmed these do not yet exist.
2. Dedicated log-recovery custodian/key outside the archive host, approved on-call
   receiver and independent dead-man monitoring. No live notification delivery or
   incident-response coverage has been validated.
3. Matching Linux collector/forwarder integration tests: certificate rejection,
   rotation, reboot recovery, high-volume/queue-full behavior, no missed lines,
   cloud upload, version-pinned retrieval and offline recovery. Local synthetic
   tests cannot substitute for the unavailable destination.
4. Explicit scoped infrastructure/API deployment approval once the destination,
   custody, retention commitment and coverage tests are concrete. Current live
   logging is still 14 rotations or Docker size caps; preparation is not activation.
5. Clock synchronization is healthy, but NIC/NPL traceability/non-deviation evidence
   and the accountable incident contact/reporting procedure need confirmation.
6. Off-server encrypted financial backup with separate recovery-key custody and
   long-term retention remains unapproved/unavailable. No existing logs were deleted.

The [CERT-In directions](https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf)
specify 180-day ICT logs within India, designated incident contact, covered incident
reporting within six hours and five-year VDA records. The staged 181/1,830-day
retention settings do not certify coverage or satisfy the missing operational
responsibilities. S3 retention is per immutable version and cannot be shortened
in COMPLIANCE mode; see [Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html).

## Publication hold — unchanged

Do not create/edit/publish Privacy Policy or Terms, or change any existing wording.
The pending operator identity, applicable effective legal notices, documented VDA
registration/customer-due-diligence/reporting/custody/bank/tax clearance, and
substantiation of the existing guarantee remain external evidence blockers from
the prior release review. This task neither resolves them nor overrides them.

Build 8016 remains private:

- SHA-256: `1f83fbf061c6bf39e352930f988beb88bf987b03eb28daee49b83aef1e24d4ad`
- Certificate SHA-256: `475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c`
- Size: 60,367,418 bytes; API `https://api.dtexchange.app/api/v1`.

Build 8011 remains public:

- SHA-256: `8fa26acc6c86fd18ce9aad40dbc85053f39d71f248aa792267e2eb23d339545b`
- Size: 59,383,620 bytes; official URL `https://dtexchange.app/downloads/DTExchange.apk`.

Previously prepared 8016 attestation/publication package and rollback procedure
remain staged. Do not request final publication approval until the mandatory
technical/operational gates are resolved; publication requires separate approval.

Automatic approval review rejected the proposed full-record query validation over
data-egress concern. It was replaced by approved COUNT and LIMIT 0 schema checks;
no raw record export was performed. This does not authorize future log transfers.

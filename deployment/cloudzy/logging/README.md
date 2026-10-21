# Private logging package — staged, NOT deployed

This is internal operator tooling, not customer content or a legal document.
No service unit is enabled by these files. No bucket, identity, key, credential,
production log, database record, rotation rule or retention setting was changed.
`config.example.json` deliberately fails closed until explicitly approved.

## Inputs still required

- Approved private storage physically in India and its account/region/bucket.
  AWS S3 Mumbai/Hyderabad is a **reference adapter**, not a purchased/chosen service.
  Other providers need their own tested residency, retention and retrieval adapter.
- Separate recovery custodians and an age recipient. Generate a dedicated log
  identity on the approved recovery host; put **only its public recipient** on the
  VPS. Do not reuse or copy the database recovery key alongside archives.
- Private uploader credentials supplied outside the repository, with least
  privilege. Prefer short-lived workload credentials where available. AWS CLI v2
  and age must be installed from verified distributions after approval.
- Approved on-call HTTPS alert receiver/token and independent heartbeat monitor.
  No email/Telegram/SMS was sent or external recipient configured by this work.
- Capacity budget, source coverage and first full restore/retrieval acceptance.
  Object Lock COMPLIANCE cannot be shortened, including by the account owner;
  approval must explicitly cover the retention commitment and storage cost.

## Prepared behavior

`collect.py` captures Nginx, host auth/syslog/fail2ban, all current and rotated
API/admin-web/engagement/PostgreSQL/Redis Docker json-files, the last 24 hours of
system journal, and read-only database audit/login/risk records. Original logs
are never deleted, rotated, modified or truncated. Captures remain private
in memory until age encrypts them. Encrypted files/receipts are root-only.

Archive classes are ICT (181 days) and security/audit records (1,830 days, at
least five years). These are conservative technical archive minimums, **not a
legal conclusion or a replacement for the operator's retention schedule**.
There is no automatic source/spool/bucket deletion, including after expiry.
Legal holds and longer statutory/contractual periods take precedence.

Financial reconstruction still depends on the existing encrypted database
backups, including parties/beneficiaries/ledger data. The audit export excludes
bank ciphertext, proof bytes, tokens and credentials; it is not a complete
financial database backup. Off-server financial backups and separate key escrow
remain a separate approval gate. This package does not implement that transfer.

Before upload the adapter checks the exact expected AWS account and India region,
versioning, Object Lock, complete public-access blocking, private bucket policy,
and no active replication. Explicit absence of replication is distinguished from
AccessDenied/network errors. Custom endpoints are refused; AWS service endpoint
and TLS verification are fixed. Regional/account controls also need independent
cloud-account review; a name alone is not evidence of residency.

Uploads are age ciphertext plus S3 server encryption, checksum-verified by a
version-specific HEAD, with an explicit retention deadline. A local receipt pins
object version, hash, size and retention; retain a protected copy with the
recovery custodian. Retries preserve local ciphertext and may create a duplicate
immutable remote version if a network failure obscured success. They never erase
or replace a stored version. There are no delete or financial commands.

Age gives authenticated encryption, not proof of which person created a file.
Chain of custody relies on pinned trusted receipts, scoped cloud identity,
versioning/Object Lock and account-access audit evidence. A compromised host can
omit future events; an independent heartbeat/coverage monitor is required.

## Coverage and resource limits — do not overclaim

- Captures overlap deliberately. Deduplicate on source name, content hash and
  event identity during investigation; never blindly replay an audit export.
- Full capture is capped at 256 MiB; each table export is capped at 100,000 rows.
  Any limit failure stops without a success checkpoint. Partitioned collection
  must be implemented/tested before these limits are reached. No silent trimming.
- Existing Docker `5 x 10 MiB` rotation can overrun between captures. Disk-fill
  monitoring warns at half capacity but **does not guarantee lossless collection**.
  Before activation, measure peak volume; deploy/test durable continuous tailing
  to the approved India collector or increase bounded headroom under a separately
  approved change. A 15-minute timer alone does not establish full compliance.
  `continuous-forwarding.conf.template` prepares that additional imfile/TLS path
  with a synchronous persistent disk queue and pinned peer name, preserving local
  rules. It requires an India receiver and encrypted queue disk; it has not been
  started or validated against a live receiver. Queue-full, rotation, restart,
  TLS rejection and receiver-recovery tests on matching Linux are acceptance
  gates. TCP delivery alone is not proof the receiver durably archived a message.
- Old logs already aged out cannot be recreated. Preserve all currently present
  rotations before changing rules. `rotation-preserve.conf` is a reviewed template
  for Nginx/DT logs only; merge `rotate -1` into actual rsyslog/fail2ban rules while
  retaining their existing reopen hooks. Do not install overlapping stanzas or
  use forced rotation/copytruncate. Journal retention also needs actual capacity
  measurement. No such live change has occurred.
- Spool growth stops capture at 10 GiB or below 2 GiB free space; it never deletes
  evidence to recover space. Operator capacity remediation is required.
- The collector uses root read access and Docker exec; Docker socket access is
  root-equivalent. Units restrict writable paths but are not a privilege sandbox
  against a hostile Docker daemon. Do not grant this role to web/app users.

## Monitoring

`monitor.py` checks API/DB/Redis/queues/workers, clock synchronization, backup and
archive freshness, disk/Docker headroom, failed-login bursts, existing high-risk
flags, held referrals, ledger integrity and automation flags. It writes private
append-only status records, emits only fixed codes/counts and never changes
customer status, financial settings or balances. Repeated alerts are throttled
to 15 minutes; database/collector failures also attempt the configured receiver.
TLS and no-redirect enforcement protect the receiver token. Delivery failure
fails the service; a separately hosted dead-man monitor must detect host/network
outages and unacknowledged alerts. No alert-delivery SLA has been proved live.

`backend/src/common/security-observation.ts` adds bounded internal auth-result
events (including admin password/TOTP failures) without input payloads, IPs,
identifiers, URLs, credentials or response changes. It is tested locally and
requires an approved API image rollout; it is **not yet deployed**.

## Recovery procedure

1. On a private recovery host, obtain the trusted remote receipt independently.
   Use a retrieval-only cloud principal, not a key with delete/bypass privileges.
2. `python3 archive.py retrieve --config /private/recovery/config.json --receipt /private/receipt.json --output /private/retrieved`
   pins the exact version and verifies ciphertext SHA-256. It refuses an existing
   destination. Receipt and key paths here are illustrative, not real secrets.
3. `python3 archive.py verify --receipt /private/receipt.json --archive /private/retrieved/FILE.tar.gz.age --identity /private/offline/identity`
   decrypts in memory, validates the complete age stream and every inner file
   hash, and prints counts only. Without `--output`, no plaintext is written.
4. Only for an authorized incident, add `--output /private/empty-case-directory`.
   It must be empty and private. Traversal, symlinks, duplicates, oversized files
   and hash mismatch fail; no automatic archive extraction is used.
5. Record incident access, preserve original encrypted versions and hashes,
   review needed evidence privately, and dispose of case plaintext only under
   the separately authorized retention/legal-hold procedure. Never paste it into
   chat, public logs, tickets or this repository.

Synthetic tests use real age encryption/decryption and fake cloud responses.
They prove cryptographic recovery and fail-closed logic, **not live India storage**.

## Controlled deployment checklist — no execution authorization implied

1. Resolve storage/key-custodian/on-call/capacity inputs; audit the account policy,
   residency, replication and minimum retention before any production transfer.
2. Recheck backup/rollback/service health and preserve existing log/config bytes.
   No financial migration, APK or customer content change is included.
3. Request approval for the exact destination, irreversible retention settings,
   read-only encrypted record transfer, key custody, log collector/rotation units,
   monitoring recipient and optional API-only security-event rollout.
4. Install package/config/credentials root-only outside the application checkout;
   validate Python, `systemd-analyze verify` and `logrotate --debug` on the actual
   host. Dry-run collection using synthetic files on an isolated Linux host first.
5. Validate a synthetic encrypted cloud upload, exact-version retrieval, wrong
   principal denial, tamper rejection, offline recovery and alert delivery.
6. Preserve/capture all existing logs, then enable timers/continuous collection
   only after coverage/headroom and recovery pass. Observe several successful
   cycles and verify all original sources persist. Never force-delete/prune.
7. Roll back only the new timer/config/API image if necessary; keep encrypted
   archives and originals. Object Lock itself cannot be undone early. Do not
   claim compliance until retention/residency/coverage and incident-response
   responsibilities are independently accepted.

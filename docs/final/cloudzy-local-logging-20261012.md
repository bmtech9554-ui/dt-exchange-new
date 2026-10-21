# Existing-Cloudzy technical logging package — 12 October 2026

**Deployed under the user's explicit scoped infrastructure approval on 12 October
2026; live archive recovery, alert delivery and service checks passed.** No new hosting/storage account, database migration, financial policy,
customer copy, legal document, frontend design or APK change is part of this patch.

## Current live evidence

- Strict host-verified SSH works. Production API/web/PostgreSQL/Redis are healthy;
  engagement worker heartbeat is current. Existing fail2ban, firewall, rsyslog,
  Nginx, backup and health timers are active. Clock reports synchronization.
- Root filesystem: 248,505,155,584 bytes total; 232,412,778,496 bytes free at the
  preflight. Approximately 216 GiB free; 30.9 million free inodes. Log directory
  approximately 421 MiB including a 309 MiB journal. No disk cleanup was performed.
- Freshest existing encrypted database backup: checksum matched; authenticated age
  decryption and complete pg_restore parsing to `/dev/null` passed. Existing
  isolated restoration evidence retained. No production restore performed.
- All running images are inspectable. Verified recovered worker runtime artifact
  and encrypted rollback archive remain available. Its original full image index
  is not claimed recovered; the previously approved runtime recovery is retained.
- 21 migration checksums verified; no migration run. Public IDs start at 1000.
  Registration + OTP reward is 0.1 USDT, separate balance and manual release.
  Self-declared bank safeguards and permanently non-payable synthetic bank intact.
  Ledger integrity issues zero. Existing financial settings unchanged.
- Manual deposit review and manual payout remain true. Automated blockchain credit
  and automated payout remain false. Maintenance modes remain off.
- Public release remains 8011. Candidate 8016 retains its original APK bytes and
  production certificate, v2 signature and non-debuggable manifest. No rebuild.

Evidence is in `.tools/cloudzy-local-logging/`; raw credentials and log bodies are
not included in the inspection outputs.

## Approved production scope executed

1. Re-run health, disk, financial-settings digest, migration and backup preflight.
   Stop if they differ. Preserve the current API image and Compose file securely.
2. Install the hash-manifest-verified local logging package under
   `/opt/dtexchange-local-logging`. No remote storage/uploader is activated.
3. Create root-only configuration, collector state and encrypted archive
   directories on this VPS. Generate a **separate age log-archive identity** only
   if none already exists; never replace an existing identity. Store it under
   root-only `/etc/dtexchange-logging`, separate from the archive directory. This
   does not change Android signing, release attestation or database backup keys.
4. Enable local capture and authenticated recovery, then enable the three new
   systemd schedules: one-minute capture, one-minute monitoring, daily archive
   integrity. Apply CPU/memory limits, low I/O priority and restricted write paths.
5. Preserve existing source log rotation and all current files. Do not install
   the older unlimited `rotation-preserve.conf`, force rotation, vacuum journals,
   prune Docker or delete archives. Tighten previously world-readable historical
   Nginx log files to existing `0640` ownership convention without changing bytes.
6. Build a derivative API image from the **current immutable production image**,
   copying only four tested compiled files. Two existing files are asserted to
   differ only by security-event/Owner-health additions; original SQL line endings
   are retained. The other two files are new pure metadata helpers. Use no remote
   image pull, dependency upgrade, migration or entrypoint change.
7. Validate the candidate image without production credentials/network first.
   Recreate **only the API** using the existing Compose configuration and exact
   new image reference after approval. PostgreSQL, Redis, worker and web stay up.
8. Local monitoring may append deduplicated operational notifications and audit
   entries for the existing `system.monitor` permission. No role change, customer
   message, SMS, payout, ledger, transaction, bank or financial-setting write.
   Existing System Health title/navigation are reused. Only technical health data
   is added to the Owner endpoint through the existing read-only status mount.
9. Validate private permissions, archive catch-up, encryption/hash/retrieval,
   alert delivery/deduplication, Owner health and no source-log mutation. Recheck
   all service health, migration/financial safeguards and both APK identities.

The package is `.tools/cloudzy-local-logging/technical-patch.tar.gz`; its
`manifest.json` pins every member and the base image. Regenerate the package after
any source change and verify its exact SHA-256 before transfer/installation.

## Retention, capacity and evidence limits

- Configured retention minimum: **180 days**. Receipts record `retainUntil`.
  There is no automatic deletion job. Lower retention is rejected. Coverage starts
  at actual activation and available historical source files; 180 days of history
  do not appear retroactively. No claim of immutable/WORM storage is made.
- Archive budget: **20 GiB**. Free filesystem reserve: **40 GiB**. Collection
  refuses new archives at the budget/reserve boundary, leaves sources intact and
  alerts. Monitor warns before those boundaries. Increase only after reviewing
  measured volume and remaining headroom; never fill service/backup space.
- Existing Nginx/Docker/syslog rotation stays bounded. One-minute polling is
  suitable for measured traffic, not a promise of lossless capture at arbitrary
  burst rates. Backlog, missing unread sources and Docker headroom trigger alerts.
- Archives contain allowlisted technical metadata: request result/status, fixed
  authentication outcomes, deposit conflicts, SSH/fail2ban classifications and
  fixed-column audit/login/risk records. URLs, bodies, headers, cookies, credentials,
  OTPs, arbitrary message text and free-form database JSON are not archived.
  Unstructured content is represented by classification/count only. Original
  logs/database/backups remain the authoritative richer evidence, with their
  existing retention. This is not a complete forensic/raw-log replica.
- Each new archive is decrypted and its inner manifest verified before checkpoint
  advancement. A daily scan rechecks all ciphertext hashes and rotates an older
  archive through authenticated recovery. Encryption failure leaves sources
  unconsumed. Tampering or untracked/incomplete artifacts requires review; no
  automatic deletion conceals a failure.
- Local journal/private status are alert fallbacks if the API/inbox is unavailable.
  A monitor on the same VPS cannot deliver alerts during total host/network loss.
  Encrypted archives and their recovery identity share the same host failure
  domain. This is not off-server backup or disaster recovery.

## Recovery / rollback procedure

Archive retrieval (on the VPS, not copied to a laptop): choose a verified receipt;
run `archive.recover` with the recorded cipher SHA-256, root-only recovery identity
and a new empty `0700` output directory. It authenticates the entire age payload,
checks paths/member bounds/checksums, then writes `0600` files. Never print their
contents. Count/compare the selected sanitized records, remove only the explicitly
created retrieval-test files after validation; keep archive/receipt/key intact.

Operational rollback: stop/disable only the three new timers, retain archives and
keys, restore the securely saved API Compose image reference, and recreate only
API from the saved original image. No database downgrade or restore is needed.
Technical notifications/audits remain append-only. Restore prior logging-unit
configuration if any was changed. Verify API/database/Redis/worker/public APK and
financial-setting digest. Do not revert security permissions by making logs public.

## Verification and pending production work

- Linux synthetic archive/monitor tests: 39 passed, including real age encryption,
  tamper/truncation rejection, recovery, source preservation, rotation/copytruncate,
  retry, retention/budget limits, admin/SSH/deposit burst classification and safe
  alert recovery. systemd unit validation passed. Temporary test files/keys removed.
- Backend focused tests: 96 passed. Isolated tests cover record pagination, secret-safe export, deduplicated
  immutable notifications with `system.monitor` permission, zero financial writes,
  auth/OTP/TOTP/RBAC, referrals, owner and manual workflows.
- Admin/website: 51 tests and typecheck passed. Flutter analyze passed; 40 focused
  proof/biometric/bank/maintenance/theme tests passed. Existing broader feature and
  isolated payout-proof acceptance evidence is retained for unchanged code.
- Actual production archive collection, root-only separate archive-key custody,
  all three schedules, local alert delivery and the new API health projection are
  deployed and live-tested. Authenticated retrieval recovered 73,214 sanitized
  events and 282 fixed-column records from a selected archive; manifest and file
  permissions passed and private temporary recovery output was removed.
- Final catch-up check at 2026-10-12 06:50 UTC: 51 source files tracked,
  **zero backlog sources and no detected capture gap**. All 31 then-existing
  archive ciphertexts passed integrity verification; authenticated recovery passed.
  Total archive footprint approximately 3.56 MiB; filesystem free space
  232,179,380,224 bytes (approximately 216 GiB). Scheduled collection continues.
- The live SSH-authentication-failure burst generated a deduplicated Owner
  notification and append-only audit entry. fail2ban remains active. This alert
  alone is not evidence of a successful intrusion. No artificial production
  authentication attack or financial test transaction was generated.
- Owner health rejects anonymous requests with HTTP 401. The public reverse proxy
  deliberately returns 404 for `/health/ready`; this protection is unchanged.
  Readiness is verified through `127.0.0.1:4000/health/ready`, and the public
  version endpoint, website, admin and download page return HTTPS 200.
- All 21 applied migrations, financial-policy digest and pre-existing record
  hashes remain unchanged. Only operational notifications/audit entries append.
  API is the only recreated service; web, worker, PostgreSQL and Redis container
  identities are unchanged. All are healthy and the worker heartbeat is current.
- No fresh Owner password/TOTP login or maintenance toggle has been performed in
  this task; earlier authenticated acceptance remains prior evidence, not a new
  test. Any necessary fresh Owner validation uses a secure terminal.
- Samsung Build 8016 read-only checks confirmed Home rate/animated graph,
  Wallet, History, Profile, public User ID 1000, referral terms, available manual
  bank labels, and saved biometric/theme settings. Prior actual biometric and
  maintenance ON/OFF acceptance and isolated payout-proof tests remain prior
  evidence; they were not repeated as live production mutations in this task.

## Deployment evidence and rollback identity

- New API: `sha256:ff33fd7ad9fef0f5844a70d1050e552cb893c8e6ce2f8430a989059d785dc7f1`.
- Original API, still used by unchanged engagement worker:
  `sha256:c275f02808ac628a938f9dcd20484b224d7bd35006b4ce150caf44dfb6ff8169`.
  It was saved, checksum-verified, reloaded and inspected before API replacement.
- Root-only rollback directory on the VPS:
  `/srv/dtexchange/rollback/local-logging-20261012`. Original Compose file,
  image archive, record-integrity hashes and completion evidence are preserved.
- The first restart attempt stopped because the deployment helper specified a
  nonexistent CLI `compose.env` file. No service was changed by that attempt.
  Inspection confirmed this installation uses service `env_file` configuration.
  The resumed command used the existing Compose file without that CLI override,
  after comparing effective environment, mounts, command, user and read-only
  settings. No new environment file or credential was invented.
- Correct existing deployment command for this host:
  `docker compose --profile application --profile infrastructure -f /srv/dtexchange/current/deployment/cloudzy/compose.yml up -d --no-deps --no-build api`.
  Do not blindly rerun the archived first-attempt installer.
- The new archive identity has a verified encrypted recovery copy on the same
  VPS, using the existing database-backup recovery identity. Nothing was copied
  off-server. This does not protect against losing the entire VPS.
- Public Build 8011 was downloaded over HTTPS and its entire 59,383,620-byte
  payload matched SHA-256
  `8fa26acc6c86fd18ce9aad40dbc85053f39d71f248aa792267e2eb23d339545b`.
- Candidate Build 8016 remains 60,367,418 bytes, SHA-256
  `1f83fbf061c6bf39e352930f988beb88bf987b03eb28daee49b83aef1e24d4ad`;
  production signature verified, non-debuggable, no rebuild or publication.

## External blockers (not legal text)

The existing VPS was identified as Cloudzy Singapore, not India. This package
does not supply Indian-jurisdiction storage evidence. No India storage has been
provided and the user prohibits provisioning another destination. Applicable
storage/retention, incident-reporting, operator identity, privacy/legal-document
publication and VDA/financial compliance evidence remain matters for confirmation;
friends-only/manual operation is not treated as an exemption. No compliance claim
is made. Existing legal notices remain intact; legal drafts and Build 8016 remain
unpublished. Separate explicit approval is required for APK publication.

Overall logging status is **PARTIAL** against the broader retention/compliance
goal: the approved same-host technical implementation is deployed and verified,
but it is sanitized metadata rather than a complete raw forensic archive, 180
days of historical coverage cannot be created retroactively, and Indian-location
and off-server resilience evidence remain absent. No further deployment blocker
exists for this approved local scope. Same-host monitoring cannot notify during
total host/network loss; an active SSH-failure alert remains visible for review.

Official evidence references (not a legal document or compliance certification):
[CERT-In directions and FAQs](https://www.cert-in.org.in/Directions70B.jsp)
and [FIU-IND VDA guidelines updated 8 January 2026](https://fiuindia.gov.in/pdfs/downloads/VDA08012026.pdf).

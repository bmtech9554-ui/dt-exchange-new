# Backup and restore runbook

Status: **NOT_VALIDATED against live infrastructure**. Shell syntax was checked; this workspace has no pg_dump, age, production database or backup store. No backup/restore success is claimed.

## Proposed policy

Use daily encrypted logical snapshots, 30 daily and 12 monthly retained copies subject to the approved retention policy, plus managed physical backups and continuous WAL archival for PITR. Target RPO ≤5 minutes and RTO ≤2 hours are planning targets, not measured guarantees. Store backups in a separate account/region with encryption, versioning and deletion protection. Retain decryption/encryption-key versions independently under restricted recovery access.

Logical dumps cannot provide WAL-based PITR. Physical base backups plus a continuous WAL archive are required for that recovery path. Validate archival completeness and restore to a chosen timestamp on an isolated cluster. [PostgreSQL PITR documentation](https://www.postgresql.org/docs/current/continuous-archiving.html).

## Logical backup

Provision a restricted libpq service/passfile, public age recipient and backup output directory outside the repository. Run daily through the infrastructure scheduler:

```sh
bash backend/scripts/backup.sh
```

The script pipes a custom-format dump directly into age encryption, uses restrictive permissions, avoids plaintext intermediate dumps and records a checksum. It does **not** upload, prove restore success or enforce remote retention. Add the approved object-storage upload/retention adapter, verify remote ciphertext/checksum and alert on missed backup deadlines. Treat a failed pipeline or partial file as failed backup.

## Isolated restore drill

Use a dedicated empty database named `dt_restore_drill_<identifier>`. Inject RESTORE_FILE, RESTORE_AGE_IDENTITY, PGSERVICE and RESTORE_DRILL_APPROVED=isolated-empty-database. Confirm the ciphertext checksum before running:

```sh
bash backend/scripts/restore-drill.sh
```

The script refuses a non-drill database or non-empty public schema, decrypts through a pipe and restores in one transaction with error stopping. It never drops/recreates a production database.

After restore: compare table counts, migration checksums, balanced journals, order/payout state and sample authorized decryption. Check UTR/provider state against the restore timestamp. Record start/end times, target LSN/time, achieved RPO/RTO, checksums and approver. A successful `pg_restore` alone is insufficient.

## Redis and files

Use Redis AOF every second plus snapshots with noeviction; lost queue jobs must be reconstructed from PostgreSQL state. Never infer balances from restored Redis. Do not blindly replay an uncertain payout submission. Private object storage needs versioning, encrypted copies, malware/quarantine metadata and retention alignment; test authorized retrieval after restoration without exposing public object URLs.

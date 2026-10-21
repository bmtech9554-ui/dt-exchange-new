# Backup and restore drill status

DT Exchange RC1 · 1.0.0-rc.1 · Phase 8

**NOT_VALIDATED**. No live database, pg_dump/pg_restore, age executable or backup destination is available. Backup timestamp, checksum, restore duration, row counts and RPO/RTO are therefore **not measured**.

Reuse the Phase 7 backup and restore scripts. Required operator preparation: dedicated libpq service/passfile outside source, encrypted backup destination, age public recipient and protected recovery identity; isolated empty target named dt_restore_drill_<identifier>. Never restore over a running financial database.

```sh
bash backend/scripts/backup.sh
sha256sum -c /APPROVED_BACKUP_PATH/backup.dump.age.sha256
bash backend/scripts/restore-drill.sh
node backend/scripts/ledger-audit.mjs
```

Set BACKUP_DESTINATION, PGSERVICE, BACKUP_AGE_RECIPIENT for backup. For restore set RESTORE_FILE, RESTORE_AGE_IDENTITY, PGSERVICE for the isolated target, and RESTORE_DRILL_APPROVED=isolated-empty-database. The ledger command needs the restored target DATABASE_URL. Secrets stay in service files/secret manager, not shell history or documentation.

Record start/end timestamps; ciphertext checksum; source/target migration checksums; users/orders/payouts/ledger row counts; key-version availability; authorized sample decryption; journal integrity; API smoke test; and provider reconciliation at the chosen recovery point. Do not seed or reset restored real records. A clean pg_restore exit alone does not certify recovery.

PITR requires physical base backups plus continuous WAL archival; logical dumps alone are insufficient. Validate a chosen timestamp restore separately. Redis AOF/queue recovery must reconstruct work from durable PostgreSQL state, never infer balances from queue contents. Verify private object retrieval and retention in isolation. Planned RPO/RTO and retention remain Phase 7 targets until measured and approved.

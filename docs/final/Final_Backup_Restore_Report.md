# Backup and restore drill

DT Exchange · Final Production Setup · based on RC1 1.0.0-rc.1

Status: **NEEDS_INFRASTRUCTURE / NOT_VALIDATED**. No backup, checksum, restore duration or row-count result is invented. pg_dump/pg_restore, age, staging DB and restore target are unavailable.

Required: restricted libpq service/passfile, staging source, private encrypted backup destination, age public recipient and protected recovery identity, plus a separate empty dt_restore_drill_<suffix> target. Scripts already exist:

```sh
bash backend/scripts/backup.sh
sha256sum -c /APPROVED_BACKUP_PATH/backup.dump.age.sha256
bash backend/scripts/restore-drill.sh
node backend/scripts/ledger-audit.mjs
```

Set BACKUP_DESTINATION, PGSERVICE, BACKUP_AGE_RECIPIENT for backup. Set RESTORE_FILE, RESTORE_AGE_IDENTITY, PGSERVICE for the isolated target and RESTORE_DRILL_APPROVED=isolated-empty-database for restore. Do not overwrite active data. The read-only ledger command must target the restored DB through DATABASE_URL.

Record encrypted checksum, source/target timestamps, migration checksums, users/banks/orders/blockchain/ledger/payouts/audit table counts, authorized key-decryption checks, ledger integrity, provider reconciliation and application smoke results. A pg_restore success alone does not certify recovery. Test PITR/WAL recovery separately; logical dumps are not PITR. Keep worker/provider writes disabled on the restored copy until it is proven isolated.

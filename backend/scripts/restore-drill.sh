#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${RESTORE_FILE:?Encrypted dump required}"
: "${RESTORE_AGE_IDENTITY:?Secure age identity file required}"
: "${PGSERVICE:?Isolated empty restore database service required}"
: "${RESTORE_DRILL_APPROVED:?Explicit isolated restore approval required}"
test "$RESTORE_DRILL_APPROVED" = isolated-empty-database
name=$(psql -XAtc 'SELECT current_database()')
[[ "$name" == dt_restore_drill_* ]] || { printf '%s\n' 'Refusing non-drill database'; exit 1; }
count=$(psql -XAtc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")
test "$count" = 0
age --decrypt -i "$RESTORE_AGE_IDENTITY" "$RESTORE_FILE" | pg_restore --exit-on-error --single-transaction --no-owner --no-acl --dbname="service=$PGSERVICE"
psql -X -v ON_ERROR_STOP=1 -c 'SELECT * FROM ledger_integrity_issues;'
printf '%s\n' 'Restore loaded. Complete row-count, key-decryption, PITR and reconciliation checks before accepting drill.'

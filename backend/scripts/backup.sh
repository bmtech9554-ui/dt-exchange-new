#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${BACKUP_DESTINATION:?Restricted local backup directory required}"
: "${PGSERVICE:?Use a libpq service and restricted passfile; no password arguments}"
: "${BACKUP_AGE_RECIPIENT:?Public age encryption recipient required}"
mkdir -p "$BACKUP_DESTINATION"
backup_file="$BACKUP_DESTINATION/dt-$(date -u +%Y%m%dT%H%M%SZ).dump.age"
test ! -e "$backup_file"
pg_dump --format=custom --no-owner --no-acl | age -r "$BACKUP_AGE_RECIPIENT" -o "$backup_file.partial"
mv "$backup_file.partial" "$backup_file"
sha256sum "$backup_file" > "$backup_file.sha256"
printf '%s\n' 'Encrypted backup created locally. Off-site upload and restore verification are separate gates.'

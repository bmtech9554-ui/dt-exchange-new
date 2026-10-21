#!/usr/bin/env bash
set -euo pipefail
umask 077
# Explicit operator approval is required before this script, not inferred from running deployment.
: "${ADMIN_PROVISION_APPROVED:?Set only after role/provisioning approval}"
test "$ADMIN_PROVISION_APPROVED" = explicit-role-approved
read -r -p 'Admin email: ' ADMIN_EMAIL
read -r -s -p 'Admin password (16+ characters): ' ADMIN_PASSWORD; printf '\n'
read -r -s -p 'Enrolled base32 TOTP secret: ' ADMIN_TOTP_SECRET; printf '\n'
read -r -p 'Approved least-privilege role (observer recommended initially): ' ADMIN_ROLE
export ADMIN_EMAIL ADMIN_PASSWORD ADMIN_TOTP_SECRET ADMIN_ROLE
trap 'unset ADMIN_EMAIL ADMIN_PASSWORD ADMIN_TOTP_SECRET ADMIN_ROLE ADMIN_PROVISION_APPROVED' EXIT
# The existing official script owns hashing, encryption, role checking and audit logging.
docker compose -f deployment/cloudzy/compose.yml run --rm --no-deps --entrypoint node -e ADMIN_EMAIL -e ADMIN_PASSWORD -e ADMIN_TOTP_SECRET -e ADMIN_ROLE api backend/scripts/provision-admin.mjs

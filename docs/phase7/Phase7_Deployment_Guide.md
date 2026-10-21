# Deployment preparation

**Do not deploy production from this package automatically.** The current production startup intentionally refuses mock-only provider ports. Resolve the provider-readiness gates before any live deployment.

## Build and verify

From the project root:

```sh
npm ci --ignore-scripts
npm run tokens:check
npm run typecheck
npm test
npm run test --workspace @dt/admin
npm run build
npm audit --audit-level=high
node scripts/security-check.mjs
```

Build images on a Docker-capable runner:

```sh
docker build -f docker/backend.Dockerfile -t dt-backend:review .
docker build -f docker/admin.Dockerfile -t dt-admin:review .
```

Scan images, generate an SBOM, sign approved immutable digests and store them in a private registry. Do not bake environment files or TLS/signing keys into images. CI validates and builds artifacts; it contains no production deployment job.

## Configuration and services

Use `.env.example` as a key inventory, not a production configuration. Provision independently rotated RSA JWT, data-encryption, lookup and OTP keys through a secret manager. Refresh tokens are high-entropy opaque values hashed through the existing lookup-key mechanism; there is no invented unused refresh signing secret.

Use `node backend/scripts/entrypoint.mjs api|blockchain|payouts|engagement` so `_FILE` secrets load before module imports. Production also validates inside CoreModule, preventing direct worker startup from bypassing checks. Configure HTTPS origins, TLS-authenticated Redis and PostgreSQL `sslmode=verify-full` with trusted CA configuration. Set the actual proxy CIDR; do not trust arbitrary forwarded headers.

Mount actual TLS certificates at the documented Nginx paths and replace `example.invalid` domains. API/admin DNS and mobile API_BASE_URL must use HTTPS. Runtime database/Redis remain private. Production Compose requires image/environment/certificate inputs and performs no database reset or migration automatically.

## Migration runbook

1. Freeze new activity; retain confirmation, webhook and reconciliation handling.
2. Review forward migration SQL and compatibility with the previous application image. Migrations 001–006 are immutable; 007 is additive.
3. Take and verify an encrypted backup. Record its SHA-256 and restore-point evidence, not merely a fabricated string.
4. Run a single migration job with the owner/migrator identity. `migrate.mjs` takes advisory lock 74120001, checks every applied checksum, bounds lock/statement duration and commits each migration atomically.
5. For production CLI migration, set PRE_MIGRATION_BACKUP_SHA256 to the verified checksum. This is an operator attestation, not automatic backup validation.
6. Run readiness and ledger audit, then deploy API/admin and workers using compatible immutable images. Observe queues and pending payouts before re-enabling new activity.

```sh
node --env-file-if-exists=.env backend/scripts/migrate.mjs
node --env-file-if-exists=.env backend/scripts/ledger-audit.mjs
```

Never run development seeds in production. Initial reference networks/assets/rate policy require reviewed provisioning. Existing reference/role seed functions are conflict-safe but are not a substitute for an approved production configuration.

## Admin bootstrap

Use `backend/scripts/provision-admin.mjs` with secret-injected ADMIN_EMAIL, ADMIN_PASSWORD (16+ characters), ADMIN_TOTP_SECRET and ADMIN_ROLE. Roles are explicit. `super-admin` additionally requires ADMIN_BREAK_GLASS_APPROVED=explicit-provisioning. Enroll the authenticator securely, test login, then remove bootstrap credentials from the process environment. Session lifetime is 15 minutes. Keep a separate monitored break-glass account, not a shared everyday login.

## Rollback

Disable new sell/address/payout claims through operational controls. Keep status reconciliation active. Roll back application images only when schema compatibility is established; 007 should normally remain installed to preserve emergency gates. Do not drop tables, reset sequences or rewrite journals to roll back. Use a forward corrective migration for schema defects. Restoring a database requires a write freeze and provider reconciliation for every event after the restore point before any payout resumes.

## RC1 addendum

Phase 8 preserves these API/deployment contracts. See [Phase 8 commands](../phase8/Phase8_API_Documentation.md), [release certification](../phase8/Phase8_Release_Certification.md) and [operator handover](../phase8/Phase8_Developer_DevOps_Handover.md) before any deployment. Production remains blocked pending external acceptance.

# PostgreSQL validation

DT Exchange · Final Production Setup · based on RC1 1.0.0-rc.1

Status: **NEEDS_INFRASTRUCTURE / NOT_VALIDATED**. No DATABASE_URL or PHASE6_POSTGRES_URL is supplied. No external migration or connection was attempted; no data was reset/deleted.

Required values: host, port, staging database, username, password secret reference, TLS CA and verify-full policy, connection limit/pool topology, restricted migration role and disposable concurrency database. Use connectionTimeout/statementTimeout/idle transaction settings from the existing production guide. Confirm indexes, FKs, unique financial event keys and migration checksum/version 007.

After infrastructure is supplied, first validate TLS/authentication and read-only health, then review pending migrations and verified backup evidence. Run `node backend/scripts/migrate.mjs` with the approved environment; this is a forward migration process, never a reset. Do not seed an existing live database.

For isolated concurrency acceptance:

```sh
npm run build --workspace @dt/backend
DEPLOYMENT_ENV=staging node scripts/live-acceptance.mjs
node backend/scripts/ledger-audit.mjs
```

Inject PHASE6_POSTGRES_URL for a dedicated dt_phase6_test[_suffix] database and PHASE6_REDIS_URL for a dedicated test Redis DB. The harness creates/removes only its own random schema. The ledger command uses the approved DATABASE_URL and exits nonzero for unavailable/imbalanced data. Test quote consumption, orders, deposits, journal posting, payouts and referral rewards with separate server connections; record locks/deadlock/reconnect behavior and final counts. PGlite local tests do not certify live pooling/TLS/concurrency.

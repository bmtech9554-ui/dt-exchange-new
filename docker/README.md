# Development infrastructure

Phase 1 supplies PostgreSQL and Redis for local development. These services bind to loopback only. They do not process funds, expose an admin API, or create credentials for a real user.

From the repository root:

```sh
node scripts/setup-dev-env.mjs
docker compose --env-file .env -f docker/compose.dev.yml up -d
npm run db:migrate
npm run db:seed
```

The setup script creates random development passwords in an ignored `.env` and refuses to overwrite an existing file. Keep that file outside source control. The seed is repeatable and only inserts reference records. Token contracts, live rates, provider credentials, wallets and user accounts are not seeded. TRON and future networks are disabled by default.

Production application Dockerfiles, Nginx TLS/routing, least-privilege DB roles, Redis ACL/TLS, secret management, backups/restore, worker deployment and CI/CD execution belong to Phase 8. Do not use this development Compose file as a production release. Production rejects development providers and missing security configuration. Phase 4 uses the explicit TRANSACTIONS_ENABLED gate; payouts remain disabled. The separate BullMQ process is started with `npm run worker --workspace @dt/backend` after migration and chain provisioning. See the Phase 4 implementation summary for the current setup.

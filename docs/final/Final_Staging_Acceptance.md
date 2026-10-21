# Staging acceptance

DT Exchange · Final Production Setup · based on RC1 1.0.0-rc.1

Status: **NEEDS_INFRASTRUCTURE / NOT_VALIDATED** for a deployed environment. No staging host, access, DNS, database, Redis or credentials are supplied. Nothing was deployed publicly.

Existing deployment architecture is preserved: separate Nest API, blockchain/payout/engagement workers, Next admin, private PostgreSQL/Redis, reverse proxy and private metrics. Reuse docker reference files and Phase 7 deployment guide; do not deploy production compose with mock credentials. Isolated mock staging uses APP_ENV=staging, DEPLOYMENT_ENV=staging and NODE_ENV=development under the existing capability policy; it is not equivalent to production security acceptance.

Required acceptance: service startup/health, DB/Redis TLS/auth, worker heartbeat/queue recovery, admin BFF session security, reverse-proxy routing, HTTPS callbacks and any supported WebSocket forwarding. Order tracking currently uses polling; do not claim a new WebSocket transaction channel exists.

Local controlled E2E is rerun in backend tests: registration/OTP → API verification → bank → rate/quote → order → mock deposit/confirmation → five balanced journals → sandbox payout → authenticated callback/UTR → completed order → notifications/history/support → reconciliation. Existing phase suites cover referral and admin visibility. This is actual controller/SQL testing with PGlite and mock providers, not deployed browser acceptance.

After staging exists: inject STAGING_API_URL and optional STAGING_USER_TOKEN and run `DEPLOYMENT_ENV=staging node scripts/staging-acceptance.mjs` for safe read checks. Then execute the documented full staging flow using only explicit test financial providers. Record environment, build hash, request/status evidence, masked screenshots, timings and final ledger/reconciliation report. Never label a local mock run as live acceptance.

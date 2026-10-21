# Phase 8 API and operational command changes

No user/financial route or response contract is redesigned. Existing API routes remain under `/api/v1`; see Phase 3–7 API documents for auth, verification, banks, quotes/orders, ledger-derived wallets/history, payout callbacks, engagement and admin permissions.

RC1 adds configuration checks, release evidence files and operator commands, not new externally callable financial endpoints. Never expose operator scripts through a public route.

| Command | Purpose | Safety / result |
|---|---|---|
| `node scripts/release-gate.mjs release/acceptance.json` | Evaluate reviewed evidence | Exit 2 blocked; does not deploy |
| `node scripts/staging-acceptance.mjs` | HTTPS staging health/rate smoke reads | DEPLOYMENT_ENV=staging and STAGING_API_URL required; no writes |
| `node scripts/live-acceptance.mjs` | Real isolated PostgreSQL/Redis harness | Requires both dedicated test URLs; refuses missing services rather than substituting WASM |
| `node backend/scripts/validate-tron.mjs` | Read known test-network transaction and head | Requires test network and credentials; no broadcast; at most CONNECTED |
| `node backend/scripts/ledger-audit.mjs` | Consistent read-only ledger report | Exit 2 integrity issue, 1 unavailable |
| `bash scripts/native-release.sh android` or `ios` | Clean/test/package signed native RC | External SDK/signing configuration required |
| `python3 scripts/release-secret-scan.py PATH` | Scan source or ZIP | No raw secret values printed; limited pattern scope |

Environment additions: DEBUG, API_DEBUG, ADMIN_DEBUG, DEMO_MODE, ALLOW_TEST_ENDPOINTS must be false for production; STAGING_API_URL supports the read-only probe. Existing provider, database and Redis secret-file variables remain canonical. TRON_VALIDATION_TX_HASH supplies an existing known test transaction to the read-only provider check. Release API_BASE_URL is public configuration, not a credential.

Production startup additionally parses RSA signing keys, rejects mismatched/weak pairs, requires nondefault service/provider credentials and HTTPS provider URLs. The final missing-adapter refusal still applies even when all configuration checks pass. There is no “force production” switch.

For live infrastructure validation, first build the backend, inject PHASE6_POSTGRES_URL and PHASE6_REDIS_URL from an isolated staging secret source, set DEPLOYMENT_ENV=staging and run scripts/live-acceptance.mjs. Record PostgreSQL/Redis versions, TLS/auth verification, restart evidence and final ledger report. The local environment did not run this command successfully because those services are unavailable.

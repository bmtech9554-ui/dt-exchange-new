# Production configuration checklist

DT Exchange · Final Production Setup · based on RC1 1.0.0-rc.1

Run after building the backend:

```sh
npm run build --workspace @dt/backend
node backend/scripts/configuration-report.mjs
```

Output contains field names and only configured / missing / invalid. Exit 2 means missing/invalid configuration; exit 0 means the offline checks passed, not that providers connected or production is approved. Use a protected process environment or supported *_FILE paths outside the repository. Do not use command-line secret literals or commit a populated .env. The tool makes no network calls and writes no settings.

| Category | Existing / new configuration | Acceptance requirement |
|---|---|---|
| Environment | APP_ENV=production, NODE_ENV=production, DEPLOYMENT_ENV=production | All agree; invalid/conflicting aliases reject startup |
| Domains | API_PUBLIC_URL, ADMIN_PUBLIC_URL, PUBLIC_SITE_URL | Offline inventory only; owned HTTPS domains, DNS/TLS evidence still needed |
| PostgreSQL | DATABASE_URL or DATABASE_URL_FILE | PostgreSQL URL, nondefault credentials, sslmode=verify-full, trusted CA, safe pool limits |
| Redis | REDIS_URL or REDIS_URL_FILE | rediss URL, ACL user/password, trusted TLS, queue prefix |
| JWT | JWT_PRIVATE_KEY_B64, JWT_PUBLIC_KEY_B64 or file forms | Matching RSA pair, at least 2048 bits, protected private signing key |
| Refresh/security | LOOKUP_HASH_KEY, OTP_HASH_KEY, DATA_ENCRYPTION_KEY | Independent base64 32-byte keys; opaque refresh rotation remains existing implementation |
| TRON | TRON_PROVIDER, TRON_API_URL, TRON_API_KEY, TRON_NETWORK, BLOCKCHAIN_NETWORK, TRON_USDT_CONTRACT, TRON_REQUIRED_CONFIRMATIONS | Reviewed contract/network; read-only acceptance before any activation |
| Custody | CUSTODY_PROVIDER=gateway, CUSTODY_API_URL, CUSTODY_PROVIDER_API_KEY | External allocation/signing trust boundary; no private keys in app |
| Payout | PAYOUT_PROVIDER, PAYOUT_API_URL, PAYOUT_API_KEY, PAYOUT_API_SECRET, PAYOUT_WEBHOOK_SECRET | Registered reviewed adapter and sandbox evidence, not just populated fields |
| KYC/bank | VERIFICATION_PROVIDER plus chosen vendor configuration | Adapter/vendor selection pending; no invented vendor-specific credential format |
| OTP/rates | OTP_PROVIDER, RATE_PROVIDER | Registered reviewed delivery and market adapters |
| Email/SMS | EMAIL_PROVIDER/API_URL/API_KEY, SMS_PROVIDER/API_URL/API_KEY | Actual sender/template/delivery acceptance |
| Push | PUSH_PROVIDER, PUSH_PROJECT_ID, PUSH_CREDENTIALS_FILE | External FCM/APNs project/credentials and native entitlements |
| Storage | SUPPORT_STORAGE_PROVIDER/BUCKET/ENDPOINT/KEY | Private encrypted storage and owner-scoped access |
| Monitoring | METRICS_ENABLED, private metrics binding, external collector | Actual dashboard/alert delivery evidence |
| CORS | CORS_ORIGINS | Exact HTTPS origins only; no wildcard, credentials in URL or paths |
| Debug | DEBUG, API_DEBUG, ADMIN_DEBUG, DEMO_MODE, ALLOW_TEST_ENDPOINTS, MOCK_PROVIDER, DEV_OTP_EXPOSE | False in production |
| Feature controls | operational_controls in system_settings | Audited existing DB control API; no parallel env-only override |

The inventory does not load arbitrary vendor credentials and does not prove a file reference is a valid provider credential. The startup gate remains authoritative and rejects unregistered providers even if every inventory field is configured. Refresh tokens are opaque hashed values; do not invent an unused refresh JWT secret.

Payout webhook is under /api/v1/webhooks/payout/:provider. Only the mock provider contract is registered currently. KYC/bank callback routes must be implemented and reviewed for the selected adapter; do not advertise nonexistent public routes. Every financial callback requires signature/freshness checks, event deduplication and safe payload handling.

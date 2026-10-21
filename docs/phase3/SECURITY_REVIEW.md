# Phase 3 security review

## Implemented controls

- Fail-closed live session/account guard, explicit public auth routes, user-scoped SQL access and parameterized queries; no user-accessible admin/rate-policy mutation routes.
- Asymmetric JWT verification with fixed algorithm/issuer/audience; refresh rotation and family replay revocation under transaction locks; password changes revoke every session.
- Slow salted password hashing; OTP HMAC storage, five attempts, five-minute expiry, 60-second resend cooldown, per-IP/destination limits; single-use reset grants; unverified contacts cannot authenticate/recover.
- AES-256-GCM per-record encryption for contact, name, bank number and cached idempotent responses; separate encryption/HMAC/OTP keys; masked bank API output.
- Mandatory idempotency for bank creation, verification workflows and quote creation; different payload with a reused key conflicts. Monetary snapshots remain immutable.
- Exact integer arithmetic, server-owned quote terms, verified-user/bank/risk gates, user/global limits, expired/used/cancelled quote rejection and preserved Phase 1 ledger/audit constraints.
- DTO allow-list validation, bounded inputs, Helmet, explicit CORS, safe errors and request logs without credentials/body values. Production rejects development adapters and exposed OTPs. No money-moving feature flag may be enabled in Phase 3.
- Client secure refresh storage, memory-only access token, serialized refresh, explicit HTTPS release API URL. PIN/2FA/biometric preview toggles cannot claim real enforcement; a database account marked TOTP-enabled cannot obtain a new session until a real second-factor integration is available.

## Deliberate release boundaries

This is a code-level review and test suite, not an independent penetration test. External SMS/email/KYC/bank/market adapters are ports with local mocks. Production adapters, vendor callback signature verification, private document storage and credential provisioning remain integration work. Admin role/permission tables are preserved; privileged operational UI/actions remain Phase 7. A user token never becomes an admin token here.

Database-backed limits serialize a user's application writes. Multi-process PostgreSQL contention/deadlock/load tests have not been run against a deployed PostgreSQL server; PGlite does not establish those properties operationally. Phase 4 must use the same user-lock ordering and revalidate limits at order acceptance. The database trigger alone is not the entire future execution engine.

Plan periodic cleanup for expired nonfinancial rate-limit buckets and consumed OTP metadata; preserve active token lineage for replay detection and retain financial/audit/idempotency history. Encryption envelope version 1 uses configured keys; operational key rotation/re-encryption must be planned without bypassing immutable financial identity controls. Keys, backups and restore drills are deployment obligations.

The local developer inbox is never a production delivery mechanism. `DEV_OTP_EXPOSE=true` intentionally returns a code only in development; restrict the development API to trusted local access. Production fails closed without genuine adapters. No provider decisions, funds or transfers are simulated as production success.

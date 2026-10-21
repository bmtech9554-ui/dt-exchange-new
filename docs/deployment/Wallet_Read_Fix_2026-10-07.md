# Authenticated wallet read correction — 2026-10-07

The registration and verify-OTP requests returned 201. Production contained one active user, one valid session and one sent challenge; private readiness was healthy for PostgreSQL, Redis, queues and worker.

Root cause: WalletsService.balance queried the authoritative ledger, then called chainConfig() solely for sandbox metadata. In manual production the disabled chain configuration rejected the default mock provider on mainnet, raising ServiceUnavailableException. This made GET /api/v1/wallet fail after successful authentication/profile retrieval.

Fix: balance metadata no longer loads chain configuration. Production reports sandbox=false while reading unchanged ledger values. Authentication, JWT validation, session ownership/expiry, database TLS, proxy rules, financial write gates and disabled automation are unchanged. No migration or user data change.

Validation: 192 backend tests passed, including an isolated production-ledger regression with transactions disabled and missing blockchain provider configuration. A password-only local prompt was prepared to validate /users/me, /wallet and /bank-accounts using the existing verified account. It never calls OTP endpoints, and outputs only endpoint status. The original terminal disposed its access token, so reusing that token is unavailable; password login obtains a normal authenticated session without bypassing security.

No further OTP requested or sent. Authenticated public read acceptance remains pending private password entry in the secure terminal.

# Production API activation — 2026-10-07

API activation completed; interactive user/admin acceptance remains pending.

## Deployed changes

- Protected server-only app-secrets directory mounted read-only into API and engagement containers; files owned by container UID 1000 with mode 0400, parent mode 0700. No secret values printed or copied locally.
- Independent 3072-bit RSA JWT signing pair, AES encryption key, lookup key and OTP hashing key. Existing session/token randomness and hashing preserved. DV Connect key copied only within protected VPS configuration.
- PostgreSQL dt_api role: no superuser, createdb, createrole or replication; runtime DML, no migration/RBAC-table writes, no audit/journal/entry update/delete. Owner role retained only for administrative work. No database reset, seed or migration modification.
- Nine applied migrations preserved. Observed API database sessions use TLS 1.3. PostgreSQL and Redis retain private networks and persistent volumes with no public port bindings.
- Redis ACL gained INFO required by BullMQ. Readiness confirmed Redis/queues and engagement heartbeat healthy. No automatic blockchain or payout worker started.
- Manual production chain provider is explicitly dormant and rejects all operations; eager mock/mainnet startup dependency removed without fabricating data.
- Nginx maintenance gate removed after readiness passed; prior configuration retained for rollback. Trusted proxy limited to inspected Docker gateway 172.19.0.1/32. Nginx overwrites X-Forwarded-For.
- Official origins only: https://dtexchange.app and https://admin.dtexchange.app. Negative CORS check denies an unrelated origin.
- Health timer now includes private API readiness. Fresh encrypted backup completed before role provisioning; existing backups retained.

## Validation

- Backend: 191 tests passed, including disabled-chain regressions and DV Connect acceptance/failure behavior.
- Admin: 33 tests passed.
- Website, admin UI and download page: HTTPS 200.
- /api/v1/users/me without credentials: 401 (authentication enforced).
- /api/v1 itself: 404 (no index controller; not a maintenance response).
- Private /health/ready: database, Redis, queues and workers ready.
- Public APK: 404; debug/preview APK not published.
- Mobile release configuration uses https://api.dtexchange.app/api/v1; no signed release built or physical device acceptance claimed.

## Pending interactive work

One final controlled registration OTP needs the user's fresh choice of mobile number. Secure local test script prepared for password and OTP entry; no additional SMS sent during activation. First-admin role choice requested before opening provisioning prompt; credentials and enrolled TOTP secret must be entered privately. Admin authenticated workflows and synthetic operational acceptance are not yet tested on production.

JeetMax was not modified. No whitelist entry was removed or changed. No real financial transactions occurred. MANUAL_DEPOSIT_REVIEW=true, MANUAL_PAYOUT=true, AUTOMATED_BLOCKCHAIN_CREDIT=false, AUTOMATED_PAYOUT=false. Transactions/payouts remain disabled during acceptance testing.

## Registration terminal failure investigated

No final-auth send marker existed. Before diagnostic requests, production logs contained no POST requests and the database held zero users and zero OTP challenges. This establishes that the failed terminal run never submitted registration or requested SMS. The old generic catch discarded its exception, so the exact original local exception cannot be recovered. Input validation (email and password length) was a possible cause, not a proven specific user mistake.

Fixed local prompt: trim email, enforce matching 12-128 password bounds, explain and re-prompt invalid input, retain only sanitized stage/HTTP-status codes on failure, and preserve the exclusive one-send marker. Four offline input-validation checks passed. An empty production registration request returned HTTP 400 before service/provider execution; no destination or OTP was supplied. No valid production registration or SMS was retried. Await explicit approval before reopening the one-OTP prompt.

# Developer, DevOps, admin and support handover

RC1 remains BLOCKED_FOR_PRODUCTION. Read the release certification first.

Developers: use locked npm dependencies and Flutter 3.47.5 / Dart 3.13.4. Backend/admin use Node 24.19.0. Run the commands in Final_Test_Results. Keep monetary API values as strings, preserve immutable journals and provider request keys, and never bypass startup adapter registration. Add a new adapter through its port with sandbox contract tests; do not change the UI to encode vendor behavior.

DevOps: retain the Phase 7 topology: private PostgreSQL/Redis, separate API/blockchain/payout/engagement workers, Next admin BFF, reverse proxy and private metrics. Use secret-file/manager injection. Production requires verified DB TLS, Redis TLS/auth, exact HTTPS origins, strong independent keys and registered providers. Staging mock acceptance uses DEPLOYMENT_ENV=staging and NODE_ENV=development; it is an isolated test environment, not a production-equivalent security certification. Keep public test endpoints and OTP disclosure inaccessible outside that environment. See docker/compose.production.yml as a reference only; no container runtime validation occurred here.

Database operator: use backend/scripts/migrate.mjs with reviewed migration checksums, migration lock and required backup evidence. Do not modify applied 001–007 migrations. Do not run reset scripts or seed production data. Run the read-only ledger audit before/after changes. Validate deadlock/reconnect behavior on live staging before acceptance.

Admins: use a dedicated role and MFA/session policy. Financial monitoring cannot casually mark payouts successful. Emergency changes require permission, a reason and audit; pause new claims and reconcile in-flight work. See Phase 7 API documentation for the existing operational controls endpoints. Provider health labels do not prove connectivity.

Support: view only assigned/authorized user tickets, keep internal notes private, never request private wallet keys or OTPs, and route stuck deposits/payouts to financial operations. Provide status from backend records; never invent a UTR or completion estimate. Escalate P1/P2 under the first-day monitoring matrix.

Release operator: verify SHA-256 and source manifest, resolve all external blockers, obtain explicit deployment approval, then follow the ordered production-day plan. No scripts in this phase deploy production automatically. Keep signed native binaries and secret/signing material outside source archives. Keep evidence reports versioned and redact personal data.

API compatibility: existing /api/v1 routes are unchanged. No database migration or new financial endpoint is introduced. Additional commands: scripts/release-gate.mjs, scripts/staging-acceptance.mjs, backend/scripts/validate-tron.mjs, scripts/native-release.sh and scripts/release-secret-scan.py. Provider probe failures produce safe status codes/messages without credentials.

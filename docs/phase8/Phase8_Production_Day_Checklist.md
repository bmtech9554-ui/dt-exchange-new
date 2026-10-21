# Production day and rollback checklist

DT Exchange RC1 · 1.0.0-rc.1 · Phase 8

**Execution not authorized.** All release blockers must close first, followed by explicit production setup/deployment approval. Assign named release lead, financial operations owner, security owner, DBA and incident commander; no names are assumed.

1. Release lead verifies RC/archive hashes, source manifest, signed build identities and the complete go/no-go evidence matrix.
2. DBA verifies encrypted backup checksum, successful restore/PITR evidence, key recovery and rollback-compatible migration plan.
3. DevOps verifies PostgreSQL pool/TLS/timeouts, Redis TLS/ACL/noeviction, worker namespaces and dependency readiness.
4. Security owner checks secret-manager versions, independent signing/auth/encryption keys, exact CORS and admin MFA/RBAC. Never paste secrets into logs.
5. Provider owner verifies approved adapters, sandbox reports, production connectivity/capabilities, configured USDT contract/network, custody trust boundary and payout balance/limits. No transfer is part of this checklist without separate authorization.
6. DevOps verifies owned DNS, HTTPS/TLS renewal, proxy headers, HSTS scope, webhook routing, metrics and actual alert delivery.
7. Keep registrations/deposits/sell/payouts/referrals disabled. Record versioned audited emergency controls and the previous values.
8. DBA runs reviewed forward migrations with migration lock and backup evidence. Never reset or seed production data.
9. Deploy approved API, then compatible workers, then admin using immutable images. Confirm /health/live and /health/ready. Production startup must still refuse any absent adapter.
10. Run read-only smoke checks and authorized test-account checks. Validate masked admin/user responses and reconciliation. Do not inject mock completed transactions into production.
11. Financial owner enables features gradually only under explicit approval. Watch each queue, scanner, liability and provider state. A pause does not cancel an already claimed external request.
12. Release lead records deployment/image/migration hashes, operator, time, evidence and the first-day monitoring handoff.

Rollback: incident commander disables new sell/deposit/payout claims through audited operational controls; preserve confirmation/callback/settlement reads so in-flight work can reconcile. Stop new submissions before rolling workers back. Deploy the prior compatible API/admin/worker images, keeping the same durable idempotency state. Do not roll back ledger rows or erase provider attempts. Prefer forward corrective migrations; database point-in-time restoration is a separate DBA-led incident decision because it may discard valid later events. Reconcile all external outcomes before re-enabling activity. Never replay an unknown payout with a new key.

Proposed domains only: api.dtexchange.app, admin.dtexchange.app and dtexchange.app. Ownership is unverified. Configure DNS/TLS, exact admin origin, Flutter API_BASE_URL ending /api/v1 and provider callbacks under the API domain. Keep database, Redis and metrics private. Use the existing docker/nginx production reference; do not bundle TLS private keys.

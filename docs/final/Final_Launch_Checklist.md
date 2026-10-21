# Controlled launch checklist

DT Exchange · Final Production Setup · based on RC1 1.0.0-rc.1

Plan only. Production deployment, feature activation and real transfers have not been authorized by this package. The current status is blocked.

1. Confirm organizational/provider/bank/store approvals and named release/security/financial owners.
2. Confirm encrypted backups and a successful isolated restore/PITR drill.
3. Configure production secrets through the approved manager; run offline inventory and startup checks without exposing values.
4. Verify PostgreSQL TLS/pooling/migrations/constraints/concurrency and read-only ledger audit.
5. Verify Redis TLS/ACL/queues/recovery and worker namespaces.
6. Verify owned DNS, HTTPS certificates, renewal, HSTS scope, exact CORS and proxy routes.
7. Register accepted provider adapters; validate credentials/capabilities/connectivity without moving funds.
8. After separate deployment approval, deploy reviewed backend image with financial features paused.
9. Deploy compatible workers with submissions paused; confirm heartbeat and read/reconciliation behavior.
10. Deploy admin and confirm role-scoped secure sessions/masking.
11. Run safe smoke tests: health, authorized login/profile/rate reads, admin reads, provider connectivity and DB/Redis health. Do not create a real payout or broadcast transaction.
12. Enable registrations only after owner approval and monitoring readiness.
13. Enable deposit allocation only after custody/network/contract acceptance.
14. Enable sell orders only after limits/risk/ledger readiness.
15. Enable payouts last and only after explicit controlled financial cutover approval.
16. Monitor continuously; stop rollout on integrity/reconciliation/security failure.

Use existing audited operational_controls fields: registrations, deposits, sell, payouts and referrals plus mode NORMAL/READ_ONLY/MAINTENANCE. Do not invent parallel env switches that bypass DB policy. Existing in-flight claims must still be reconciled.

Example domains dtexchange.app/api.dtexchange.app/admin.dtexchange.app are proposals, not owned/validated resources. No DNS/TLS changes were made. Mobile release must use the verified HTTPS API URL. KYC/bank callback routing awaits real adapters; only implemented signed routes may be exposed.

Real USDT/INR smoke transfers require separate explicit authorization even after all technical gates pass. Until then, only test/sandbox funds may be used in isolated staging.

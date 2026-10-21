# Inputs required to unblock setup

DT Exchange · Final Production Setup · based on RC1 1.0.0-rc.1

Supply nonsecret choices first. Provide secrets through protected runtime files or a secret manager accessible to the authorized staging environment; do not send wallet private keys or signing passwords in a document.

1. **Staging:** hosting provider, host/access method, deployment user, registry/repository access, approved staging API/admin domains and DNS access. Confirm isolated test-only use and permitted network routes.
2. **PostgreSQL:** host, port, database name, role, TLS CA/server verification, pooled/direct endpoint choice, maximum connections and secret reference. For concurrency tests provide a disposable database named dt_phase6_test or dt_phase6_test_<suffix>. For restore provide a separate empty dt_restore_drill_<suffix> target.
3. **Redis:** host, port, ACL user/password secret reference, TLS CA, dedicated test DB 1–15 and queue namespace. Never use production queue keys for the test harness.
4. **TRON/custody:** selected API provider and custody model, test endpoint/key reference, network, configured test token contract, a known test TxID and address-allocation API specification. Production contract verification is a separate recorded step; no transfers are required for read checks.
5. **Payout:** vendor name, API documentation, sandbox URL, credentials/webhook secret references, beneficiary test fixtures, supported rails and evidence of provider authorization for this business. Actual adapter implementation cannot be inferred from credentials alone.
6. **Verification:** KYC/bank vendor names, sandbox API docs/access, signed callback contract, required verification fields, failure/retry rules and approved data retention.
7. **Delivery/storage:** email/SMS/push providers, sender/project configuration, storage bucket/region/private policy and secret references. Monitoring collector, alert destination and escalation contacts.
8. **Mobile:** confirmed Android package ID and Apple bundle/team IDs, external Android keystore/alias, protected signing configuration, Mac/Xcode access and app-store accounts. Signing files must stay outside source archives.
9. **Organization:** named accountable approvers for provider/bank authorization, required verification/limits/reporting, privacy/terms/support URLs, retention, store declarations and controlled cutover.

Current status: none of these environment-specific inputs was supplied in this task. Provisioning, purchases, DNS changes, public deployment, external notifications and real-money activity are not silently performed.

# Release checklist

All unchecked items are release gates, not completed deployment claims. Phase 7 source preparation does not authorize live funds.

## Source gates

- [x] Approved brand, navigation and financial model preserved.
- [x] Production mocks and unregistered adapters rejected.
- [x] Audited, versioned operational controls and immutable ledger audit prepared.
- [x] API/admin validation, least-privilege permissions and safe error handling prepared.
- [x] Docker, Nginx, CI, monitoring and recovery material included.
- [x] Available regression/build evidence recorded in Phase7_Test_Results.md.

## Infrastructure and operations

- [ ] Select domains, TLS certificates and private service networks.
- [ ] Provision PostgreSQL TLS, owner/runtime/read-only roles, pool capacity and connection alerts.
- [ ] Provision Redis TLS/ACLs, noeviction, persistence and isolated environment queues.
- [ ] Execute live concurrency and Redis recovery harnesses; save reports.
- [ ] Build/scan/sign immutable container images; pin reviewed CI action revisions.
- [ ] Validate Nginx syntax, TLS redirect, CORS, proxy CIDR and request limits.
- [ ] Enable external exporters/readiness probes; route a synthetic alert to an approved responder.
- [ ] Test absent worker, queue backlog, stale scan, payout delay and reconciliation alarms.
- [ ] Verify encrypted daily backup, off-site retention, key recovery and PITR restore drill.
- [ ] Approve RPO/RTO, incident owners, on-call escalation and rollback rehearsal.

## Providers and product

- [ ] Register reviewed OTP/verification/market/payout/email/SMS/push/storage adapters.
- [ ] Validate sandbox signature, replay, idempotency, unknown timeout and reversal scenarios.
- [ ] Independently verify network/USDT contract/finality policy and custody trust boundary.
- [ ] Enable mainnet only through explicit approved configuration after acceptance tests.
- [ ] Verify payout rails, limits, beneficiary verification, UTR and reconciliation with provider evidence.
- [ ] Configure retention, private attachments, operating/compliance requirements and privacy/terms.
- [ ] Check admin role assignments/MFA/session expiry and sensitive actions in a real browser.
- [ ] Publish approved Android/iOS identities, sign builds and test physical devices.
- [ ] Confirm push permissions/deep links/biometric behavior only after actual adapter integration.
- [ ] Execute staging smoke tests and independent security review.
- [ ] Obtain explicit production deployment approval. No automatic deployment is configured.

Emergency switches stop new claims, not transactions already submitted externally. Reconcile unknown work before retrying or restoring service.

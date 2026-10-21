# Updated production blockers

Final status: **BLOCKED_FOR_PRODUCTION**.

The implementation and local validation do not authorize financial launch. The following remain required for this manual Android release:

| Blocker | Exact state / required action |
|---|---|
| Production backend/admin/website hosting | NEEDS_INFRASTRUCTURE. Supply reviewed deployment target; run staging acceptance before production. |
| Live PostgreSQL | NOT_VALIDATED. Supply TLS/authenticated staging instance; run all migrations safely and manual/financial concurrency tests. PGlite tests do not validate live pooling, locks under load or restart behavior. |
| Redis/BullMQ | NOT_VALIDATED. Supply authenticated/TLS Redis where required; test engagement jobs, retry/recovery and operational monitoring. Automatic financial workers stay disabled. |
| Private evidence storage operations | Encrypted PostgreSQL storage implemented; live persistence, capacity, retention, encryption-key rotation/recovery and authorized download acceptance remain NOT_VALIDATED. |
| Production secrets | NEEDS_CREDENTIALS. Configure independent encryption/hash keys, JWT keys, DB/Redis authentication and public release-attestation key securely. No credentials were supplied or used. |
| Required OTP/KYC/bank verification and notifications | Production adapters/credentials/acceptance remain BLOCKED. Existing code still intentionally refuses unregistered live authentication/verification/delivery/storage adapters; changing an environment label is not an integration. Manual financial mode does not waive identity/AML requirements. |
| Receiving wallet | NEEDS_MANUAL_ACTION. Verify business custody/ownership, exact TRC20 address, configured USDT contract, network and confirmation policy. No key is stored by this API; no actual chain transaction was validated. |
| Admin operating acceptance | NEEDS_MANUAL_ACTION. Assign least-privilege financial roles, validate real browser workflows, operator training and independent external-bank/chain reconciliation. SSR tests are not browser acceptance. |
| Domains / HTTPS / CORS | NEEDS_INFRASTRUCTURE. Prove ownership, DNS, TLS/renewal, proxy and actual HTTPS API/website endpoints. No assumed ownership of dtexchange.app. |
| Signed Android APK | ANDROID_SIGNING_PENDING. Android SDK/tooling and external keystore/signing/attestation material unavailable; no APK, APK size or APK hash can be certified. Validate real-device install/update and release API URL. |
| Website artifact publication | BLOCKED until matching signed APK and verified metadata are supplied; public download currently unavailable by design. |
| Backup / restore and disaster recovery | NOT_VALIDATED on live staging. Test isolated restore including encrypted evidence and external key recovery; test API/worker/DB/Redis recovery without duplicate entries. |
| Monitoring / alerts | NOT_VALIDATED. Connect dashboards/alerts for queue, DB capacity, manual-review backlog, ledger integrity and security incidents; exercise escalation. |
| Organizational / compliance | EXTERNAL_REQUIREMENT. Business-bank authority, custody policy, KYC/AML/limits/retention, terms/privacy, role approvals and launch authorization must be supplied by the organization. |

## Not initial-release blockers

- Automatic blockchain detection/credit provider acceptance: **AUTOMATION_FUTURE / OPTIONAL FOR INITIAL MANUAL MODE**.
- Automatic INR payout provider acceptance: **AUTOMATION_FUTURE / OPTIONAL FOR INITIAL MANUAL MODE**.
- Google Play listing, Play Console, review/publishing: **FUTURE_REQUIREMENT**.
- iOS build/signing, App Store Connect, Apple review/publishing: **FUTURE_REQUIREMENT**.

Provider interfaces, historical store documents and prior phases are retained. Do not enable production financial activity, transfer INR/USDT or deploy automatically. After all required evidence exists, obtain explicit authorization for controlled live cutover.

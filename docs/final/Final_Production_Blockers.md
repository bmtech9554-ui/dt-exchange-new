# Remaining production blockers

DT Exchange · Final Production Setup · based on RC1 1.0.0-rc.1

**BLOCKED_FOR_PRODUCTION**

| Area | Status | Required next input / evidence |
|---|---|---|
| Real TRON acceptance | NEEDS_CREDENTIALS | Selected provider, test endpoint/key, network/token configuration and existing known test transaction |
| Custody | NEEDS_CREDENTIALS | Selected external custody gateway, allocation contract and sandbox credentials; no raw wallet key |
| Real payout | NEEDS_CREDENTIALS | Vendor and business approval, API specifications, sandbox endpoint/key/secret, signed webhook contract, supported rails |
| KYC and bank verification | NEEDS_CREDENTIALS | Selected vendor, sandbox access, callback/signature specification, approved identity/bank mappings |
| Vendor adapter registration | BLOCKED | Reviewed implementations for payout, OTP, verification, rate, email, SMS, push and storage; credentials alone are insufficient |
| PostgreSQL | NEEDS_INFRASTRUCTURE | Isolated staging server/database, TLS trust chain, role/access and connection secret |
| Redis | NEEDS_INFRASTRUCTURE | Isolated staging endpoint/port, ACL credentials, TLS trust chain, test DB and queue namespace |
| Android | NEEDS_MANUAL_ACTION | Android SDK/build tools, external keystore/alias, owned package ID and verified HTTPS API URL |
| iOS | NEEDS_MANUAL_ACTION | macOS/Xcode, Apple team/profile, owned bundle ID and signed-device validation |
| Staging | NEEDS_INFRASTRUCTURE | Staging host/access, image registry, network rules, test secrets and deployment domains |
| Domain/TLS | NEEDS_INFRASTRUCTURE | Confirm domain ownership, DNS/reverse-proxy access, certificates and renewal evidence |
| Browser/admin | NEEDS_INFRASTRUCTURE | Reachable staging deployment and browser/device acceptance environment |
| Backup/restore and DR | NEEDS_INFRASTRUCTURE | Staging DB, isolated restore target, backup tools/store, protected decryption identity and approved fault-drill window |
| Monitoring/alerts | NEEDS_INFRASTRUCTURE | Private collector/dashboard, alert receiver, incident contacts and approved test-alert routing |
| Production secrets | NEEDS_CREDENTIALS | Organization-managed secret paths/versions; do not paste values into reports |
| Store packages | NEEDS_MANUAL_ACTION | Developer accounts, signing, signed screenshots, live privacy/terms/support URLs and review declarations |
| Organization/compliance | NEEDS_MANUAL_ACTION | EXTERNAL_REQUIREMENT: provider/bank authorization, operating approvals, KYC/AML/limits/retention/reporting/store declarations |

No blocker above has been waived. Local tests are PASS only within their documented scope. No external provider is CONNECTED or VALIDATED in this execution. Credentials should be supplied through an approved runtime secret mechanism, not source files, ZIPs or chat logs. Production deployment and financial movement remain unauthorized.

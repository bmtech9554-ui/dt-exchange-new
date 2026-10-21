# Manual production activation readiness — 2026-10-07

## Current scope

Local preparation only in this update. The existing strict SSH connection returned KEY_ACCESS_OK. Web, PostgreSQL and Redis containers were healthy; nginx and fail2ban active; backup and health timers enabled. No production application configuration or maintenance gate was changed.

## Adapter classification

| Adapter / capability | Classification | State |
| --- | --- | --- |
| SMS OTP | A — required for mobile registration/authentication | BlackSMS selected by the user. Its documented POST /sms adapter is implemented locally and covered by synthetic request/failure tests; credentials and real delivery acceptance remain pending. No production development OTP fallback. |
| PostgreSQL / Redis | A — required | Existing private TLS infrastructure; API connection acceptance still pending. |
| Financial evidence storage | A — required | Existing PostgreSQL encrypted payload storage, authenticated owner/RBAC access, 5 MiB validation and PNG/JPEG/PDF signature checks. No public directory. Existing private-proof regression coverage retained. |
| Manual bank review | A — required before bank-dependent transactions | New local adapter records UNDER_REVIEW, never verified. Existing admin review-note operation does not approve banks; permissioned approval workflow remains to be completed and tested. Verified-bank sell/payout requirement retained. |
| Identity/KYC | B — disabled | Local routes fail closed when disabled. No user marked verified. Legacy records/interfaces retained. |
| Generic email / SMS / push notifications | B — disabled | Explicit capability flags; in-app notifications retained. Disabled adapters cannot report delivery success. OTP uses a separate required channel. |
| Support attachments | B — disabled | Mock storage cannot serve production files. Financial proof/receipt storage is separate. |
| Automatic blockchain credit / payout / custody allocation | C — future | Remain disabled. No automatic provider connected or financial transaction performed. |
| External market rates | B — unused in manual-rate product | No sample rate may become a production market quote. Existing authoritative manual-rate logic must be used. |

## Activation gates

1. BlackSMS adapter implemented from https://blacksms.in/docs. Supply secrets through a secure local terminal only. Validate delivery and auth with authorized test contact.
2. Finish audited, permission-controlled manual bank approval without bypassing bank ownership/verification safeguards.
3. Provision independent application secrets and a least-privileged database role; test API/engagement worker against TLS databases and queue ACLs.
4. Start API behind maintenance gate, validate health/CORS/auth, then remove gate only after required checks pass.
5. Official first-admin provisioning needs secure password/TOTP entry. No default credentials.
6. Mobile connected release configuration already points to https://api.dtexchange.app/api/v1. End-to-end authenticated testing remains blocked on API/OTP.
7. First Android signing identity requires explicit approval. No debug APK publication; public Android download stays disabled.

## Off-server recovery plan (not executed)

Keep existing encrypted VPS backups intact. Choose an approved off-server private object-storage destination with versioning, retention and a restricted upload-only identity. Transfer only encrypted backup artifacts and checksums there. Store the age decryption key separately in an approved password manager or encrypted offline recovery medium, with different access controls; never beside the ciphertext or in the same laptop folder. Obtain explicit approval for destinations and each recovery-material transfer. Run a restore drill in an isolated environment using separately retrieved materials; retain verification metadata, not keys or plaintext dumps. No recovery material was transferred in this update.

## Financial configuration

MANUAL_DEPOSIT_REVIEW=true
MANUAL_PAYOUT=true
AUTOMATED_BLOCKCHAIN_CREDIT=false
AUTOMATED_PAYOUT=false

No financial execution or public APK release authorized by these preparation changes.

BlackSMS update: backend 179/179 tests passed. A local hidden-input PowerShell prompt was opened for API key, sender ID and SMS route; no SMS sent and no API activation performed. Production deployment remains pending credential entry and remaining acceptance gates.

# Data privacy inventory

DT Exchange RC1 · 1.0.0-rc.1 · Phase 8

Technical inventory for disclosure preparation, not a legal retention decision. No exact statutory duration is invented. Retention values must be approved and implemented before launch; backups and processors must follow the same policy.

| Data | Purpose | Storage / access | Retention class | Provider transmission |
|---|---|---|---|---|
| Name, email, mobile | Account/authentication/contact | PostgreSQL encrypted contacts + lookup hashes; owner and authorized account roles | Account lifecycle + approved retention | OTP/email/SMS and verification adapters |
| Password, PIN, OTP | Authentication | Strong hashes; OTP expiry/attempt state; auth service only | Credential lifecycle; short OTP lifetime | OTP plaintext only to selected delivery adapter, never logs |
| Bank holder/account/IFSC | Beneficiary verification/payout | Encrypted bank/snapshot fields; normal responses masked; payout service restricted | Financial record retention | Bank verifier and payout provider |
| KYC documents/PAN/selfie | Required verification | Verification records/private storage port; restricted reviewers | Approved identity retention | Selected verification provider only |
| Orders/deposits/payouts/UTR/ledger | Financial integrity/reconciliation | PostgreSQL append-only accounting and audit; owner or financial RBAC | Financial/audit retention | Relevant blockchain/payout provider references |
| Blockchain address/hash | Detect deposits/confirmations | Wallet/chain tables; owner + financial monitoring | Financial record retention | Public chain/provider queries; public-chain data cannot be erased by app |
| Device/session/IP risk data | Session security/abuse prevention | Hashed tokens/device identifiers and session records; auth/security roles | Security retention | Delivery metadata as required; no advertising use implemented |
| Push tokens/preferences | Notification delivery | Encrypted token storage; owner settings, delivery workers | Token validity/account lifecycle | FCM/APNs adapter when registered |
| Support messages/files | Resolve user issues | Encrypted/private storage abstraction; owner + support RBAC | Support case retention | Private storage/delivery adapters when enabled |
| Referral relationship/rewards | Attribution and audited rewards | Referral tables/ledger; owner + referral RBAC | Campaign + financial retention | Invite share is user-initiated |
| Audit/operational logs | Investigation/recovery | Restricted log/audit stores; role-scoped | Audit/security retention | Approved monitoring processor only |

No production advertising/tracking SDK is added. This is not a final assertion of store “tracking” or “sharing” answers: the privacy owner must inspect actual vendor contracts/SDK behavior and purposes. Record encryption in transit/at rest, account-deletion request handling, access requests, geographic processing, subprocessors and retention exceptions. Deletion must preserve required ledger/audit records and explain those limits to users. Do not expose KYC/support objects through public URLs.

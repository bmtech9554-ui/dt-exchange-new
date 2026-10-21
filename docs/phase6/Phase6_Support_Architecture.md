# Phase 6 — Support and settings architecture

SupportService provides owner-scoped paginated tickets, detail threads, idempotent creation/replies and closure. Supported categories are Account, Bank Account, USDT Deposit, Sell Order, Payout, Transaction Delay, Security, Referral, Technical Issue and Other. State transitions use OPEN, IN_PROGRESS, WAITING_FOR_USER, RESOLVED, CLOSED. Closed/resolved tickets reject user replies.

Ticket bodies and every message are encrypted using ticket/message-specific contexts. Subjects and safe metadata remain searchable for support. Optional order/payout references are validated against the user's ownership. Detail/list APIs omit internal notes; admin details require support.write. All admin changes require a reason and append audit records. Assignment verifies an active admin with support permission. External admin replies generate a notification; internal notes do not.

## Attachments

SupportStorageProvider separates application authorization from object storage. Metadata validates PNG/JPEG/PDF and 1 byte–5 MiB size; ticket and attachment owner checks apply before access. Random private keys are never returned as public URLs. States PENDING, QUARANTINED, AVAILABLE, REJECTED allow a future upload-completion and malware-inspection pipeline. The mock creates metadata only, returns no upload URL and cannot make an attachment AVAILABLE. Production mock upload preparation fails closed. Implement authenticated completion, content sniffing, scanning, short-lived signed access and storage retention before enabling real uploads.

## Help content

Public `/support/faq` lists only published articles ordered by rank/ID. FAQ management requires support.faq; the admin can create/edit/publish/unpublish/reorder. Seeded product guidance contains no promises of guaranteed payout timing. Privacy and terms are fetched from backend settings and clearly show an unpublished state until approved content exists.

## Security/settings

PINs are six digits, scrypt-hashed, never returned, and require the current password to set. Verification has a durable attempt counter, five-failure/15-minute lockout plus API limits. Invalid attempts commit before an error is raised. A successful PIN check returns `authorizationGranted:false`; protected actions still require backend authorization.

Existing session-family logout/revocation remains authoritative. Settings shows real PIN state and device controls. Biometric token unlocking and TOTP enrollment are readiness interfaces only; no toggle falsely enables them. App animation preferences and notification settings are persisted.

Deletion verifies the password and locks the account, rejects outstanding orders/nonzero ledger balances, deactivates the user and revokes sessions/tokens. Required financial/audit records are preserved. Anonymization remains a retention-review process; no unapproved legal retention period is hardcoded.

# Phase 6 — Notification architecture

`NotificationService` owns notification creation, preferences, registration, inbox reads and delivery. Existing financial domain code remains authoritative. Notification rows committed alongside domain events act as the durable notification outbox; scanning them does not depend on a best-effort Redis publish succeeding.

## Event paths

PostgreSQL engagement triggers insert deduplicated notifications inside transactions for first new-device sessions, bank creation/verification, user verification/password updates, sell-order creation and deposit detection/credit. Session token rotation does not generate new-device spam. Phase 5 payout service continues its atomic payout processing/success/failure/review/completion events. Support and referral services call the central service within their transactions.

Types: ACCOUNT, SECURITY, DEPOSIT, SELL_ORDER, BLOCKCHAIN, PAYOUT, REFERRAL, SUPPORT, SYSTEM. Channels: IN_APP, PUSH, EMAIL, SMS. Legacy payout event names remain intact and are categorized during dispatch.

## Reliable delivery

The engagement worker scans at 30-second intervals, up to 100 pending records per dispatch. Fanout locks the notification and inserts unique `(notification_id, channel, destination_key)` deliveries. The IN_APP delivery is the completion marker for atomic fanout. Database uniqueness prevents double fanout even with overlapping workers.

Delivery claims lock a row, increment its attempt counter and lease it for 45 seconds. Provider calls use stable delivery IDs as idempotency keys, an abort-aware timeout/circuit hook, maximum five attempts and exponential eligibility delays. Worker jobs also retry with backoff and preserve failed jobs. An expired lease can be recovered from PostgreSQL if Redis loses work. No raw provider exception or recipient is logged. Vendor adapters must honor AbortSignal and enforce idempotency or reconcile uncertain delivery outcomes before retrying; the port alone cannot guarantee vendor-side exactly-once delivery.

Delivery states: QUEUED, SENT, DELIVERED, FAILED, SKIPPED. The mock deterministically returns a SANDBOX reference. SENT does not mean a real phone/email received a message; production mocks reject calls. Real delivery receipts require a vendor-specific authenticated adapter.

## Preferences and tokens

Preferences cover push/email/SMS, transactions, security, referral and support. Security alerts cannot be switched off, and email security delivery is attempted even if normal email alerts are disabled, subject to a verified contact. In-app records remain available. Preference and active-session checks are repeated before dispatch. No verified contact, revoked device or closed account leads to SKIPPED.

Push tokens are encrypted with an ID-specific context and HMAC-indexed; API responses expose only device ID/platform. Tokens bind to a session family, survive refresh rotation and become ineligible when the family is logged out. A token cannot be claimed by another account. Flutter `DevicePushAdapter` supplies a native SDK token after consent; no FCM/APNs project is fabricated.

## Admin and announcements

Delivery inspection/retry requires notifications.manage. Targeted SYSTEM messages accept at most 100 active user IDs and a reason; repeated request IDs deduplicate notifications. Announcements require notifications.publish and support ALL_USERS, VERIFIED_USERS or up to 100 SPECIFIC_USERS. Announcements are pulled by active audience/date filters; broad announcements do not trigger unbounded push/SMS sends.

OTP delivery retains the existing secure dev inbox. `MessagingOtpProvider` is an explicit alternative bridge to email/SMS providers using OTP templates. Bind only audited non-mock adapters for production; plaintext OTPs are never put into notification tables or logs.

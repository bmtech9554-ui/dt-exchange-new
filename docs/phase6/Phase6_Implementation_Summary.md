# DT Exchange — Phase 6 implementation

Phase 6 extends the approved Phase 5 project in place. No production deployment or bank transfer was performed. Phase 7 has not started.

## Delivered

- Central, paginated in-app notifications with read/read-all/archive, encrypted session-bound push registrations, channel preferences, safe delivery logs, bounded retries and a BullMQ engagement worker.
- Atomic notifications for new-device login, password/verification changes, banks, sell orders, deposits/confirmations, existing payout events, support replies and referral rewards. Existing payout notifications remain compatible.
- Provider-neutral push/email/SMS contracts, mock providers and an explicit OTP messaging bridge. Production mocks fail closed. FCM/APNs, email/SMS vendors and their delivery receipt handlers still need audited adapters and credentials.
- Unique referral codes, optional registration code, HTTPS invite links, configurable versioned rules, qualification from settled completed orders, device/bank/risk screening, locked double-entry reward journals and permanent event idempotency. Sandbox qualification is opt-in and forbidden in production.
- Encrypted support threads, owner-only ticket APIs, replies, closure, transaction references, metadata-validated private attachment ports, published FAQs, audited support assignment/escalation/internal notes.
- Persisted settings, six-digit scrypt PIN with lockout, existing device/session controls, notification preferences, legal-content endpoints and retained-history account deactivation. Biometrics and 2FA are explicitly readiness interfaces, not fake enabled features.
- Next.js Support/FAQ, Referral Review/Rules, Notifications/Announcements/Delivery Logs and System Health/Queue views. Separate role permissions; no automatic grants to all admins. Targeted notification sending is limited to 100 active users per request.
- Database/Redis/worker readiness, safe request IDs and timing logs, bounded-cardinality metrics hooks, provider timeout/circuit primitive, shared Redis connection policy, PostgreSQL transaction timeouts and opt-in real-infrastructure concurrency tests.

## Compatibility and visual lock

The 22-file baseline hash check preserves migrations 001–005, approved logo files, design tokens, core widgets, Profile and four-tab navigation. Existing financial amounts, locked quotes, payout submission/settlement/reversal and bank snapshots were not redesigned. Migration 006 adds engagement fields/tables and atomic notification triggers. It extends the allowed journal event type for referral rewards.

Mobile screens use existing white/mint/teal/blue/navy cards, buttons, transitions, reveal/copy/success animations and skeleton components. Main Profile remains User Details, Bank Accounts, Referral Program, Settings and Logout. Navigation remains Home, Wallet, History, Profile.

## Local setup

1. Install the pinned workspace and Flutter dependencies as documented in the existing README.
2. Configure `.env` using `.env.example`; generate development keys with the existing setup script.
3. Run `npm run db:migrate`. Keep migration checksums immutable after applying.
4. Run existing Phase 3–5 seeds, then `node --env-file-if-exists=.env backend/scripts/seed-phase6.mjs`.
5. Start API/admin as before. Start `npm run worker:engagement --workspace @dt/backend` with Redis configured. Blockchain/payout workers remain separate.
6. Grant support, engagement or observer roles explicitly to an existing admin. No admin account or credential is created by the new seed.
7. Referral campaign defaults disabled; use audited admin rules to set dates, reward paise, transaction eligibility and cap. Invite base URL must be HTTPS. The supplied example.invalid URLs are build/test fixtures, not a deployment.

## Boundaries

External message delivery, native push/biometrics/TOTP enrollment, production private object storage, legal-policy publication and retention/anonymization policy approval remain deployment integrations. Attachment mock returns no usable upload/public URL and never pretends a file was stored. Reward credits are separate INR ledger balances; this phase adds no withdrawal product. Reward exposure after an order reversal is held for manual review without deleting financial history.

See the architecture/API/test documents and `validation/` evidence. Stop here until **Continue Phase 7**.

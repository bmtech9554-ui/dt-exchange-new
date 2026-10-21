# Phase 6 — Referral architecture

Each active verified referrer gets one stable cryptographically random `DT` code. Generation is serialized on the user row; database uniqueness is retained. An optional registration code is claimed in the registration transaction, or `/referrals/claim` is available during the first 24 hours before an order exists.

## Rules and qualification

Rules are held in versioned `system_settings.referral_rules`: enabled, FIXED_INR reward type, integer-string reward paise, minimum completed transaction paise, maximum rewards per referrer and campaign start/end. A claim persists an immutable-in-practice rule snapshot for its qualification; subsequent configuration does not silently change its amount. The global enabled switch can pause processing. Rule updates require referrals.rules and an audit reason.

Lifecycle: INVITED, REGISTERED, QUALIFIED, REWARDED, REJECTED. The worker selects registered/qualified referrals with completed orders, rotating by last check time to avoid starving newer records. It locks the two users in UUID order and locks the referral. Both users must remain active/verified. Shared device hashes, matching bank fingerprints and open risk flags cause review. Self-referrals, repeat claims and late claims are rejected.

Qualification requires a completed sell order, successful payout, matching settlement journal, no settlement reversal and the configured minimum locked INR amount. Mock payout qualification is off by default; `REFERRAL_ALLOW_SANDBOX=true` is only effective outside production. A client cannot signal qualification or trigger arbitrary rewards.

## Accounting and concurrency

The reward transaction posts a balanced journal keyed `referral:<id>`: debit platform INR referral expense; credit referrer INR available liability. It then links `reward_journal_id`, records the integer paise amount, marks REWARDED, audits and creates a notification. There are no direct balance mutations. Per-referrer locks enforce the reward cap across concurrent referrals, and permanent ledger event uniqueness prevents repeat credit.

Concurrent calls are tested against PGlite's serialized PostgreSQL engine and an opt-in real PostgreSQL harness. PGlite tests establish constraints and transaction behavior but do not replace multi-connection lock validation.

If the qualifying order later ceases to be completed, the worker flags reward exposure and raises a risk flag. Historical reward entries remain intact; any recovery is an audited accounting decision, not silent balance deletion. Admin review can reject unrewarded referrals; it cannot manually manufacture a reward or overwrite posted journals.

## Client

The referral screen reads code/link, total and qualified referrals, exact reward totals and recent referral states from APIs. It uses the approved cards and copy/share controls. The invite URL must be configured with HTTPS; otherwise the screen offers code sharing and states that the link is unavailable. No gambling or gaming features were introduced.

# Admin acceptance

DT Exchange · Final Production Setup · based on RC1 1.0.0-rc.1

Local admin checks: see Final_Test_Results.md. Interactive deployed acceptance: **NEEDS_INFRASTRUCTURE / NOT_VALIDATED**. No admin UI source was changed.

| Module group | Available evidence | Remaining acceptance |
|---|---|---|
| Dashboard/users/verification/banks | Existing Nest RBAC/masking tests; SSR/BFF checks | Browser login, search/page/filter, loading/error states |
| Deposits/orders/payouts/reconciliation | Local financial controller and settlement/review tests | Deployed synthetic transaction visibility and operator workflow |
| Referrals/support/notifications/announcements/FAQ | Existing authorization and engagement tests | Browser CRUD/status/filter and private-note behavior |
| Audit/queues/health/providers/settings | Role-scoped operations and emergency-control tests | Actual infrastructure health and safe redaction in browser |

Bank data remains masked in normal/admin views. Existing role checks deny unauthorized operations. Emergency settings are versioned and audited with reasons; DB transaction gates stop new registrations/deposit allocation/sell/payout/referral activity. Preserve current configuration version when changing it to avoid overwriting a concurrent operator's update. Maintenance is reversible through the same authorized interface.

Provider disabling uses the relevant existing activity controls and reviewed deployment configuration; no unimplemented generic live provider-switch UI is claimed. A pause cannot cancel an external request already claimed before it commits. Continue confirmation/callback/reconciliation handling and investigate uncertain results. Do not manually mark payouts successful. All external role grants or setting changes remain unperformed.

# Rollback plan

DT Exchange · Final Production Setup · based on RC1 1.0.0-rc.1

Rollback is an operator procedure; nothing is executed automatically. Assign an incident commander, financial owner and DBA before launch.

1. Disable new registrations/deposit allocation/sell/payout/referral activity with existing permission-checked, reasoned, versioned operational controls. Capture prior values and audit IDs.
2. Preserve callback/status polling/confirmation/reconciliation handling. A flag does not cancel an already claimed external payout.
3. Pause new worker submissions. Inspect durable attempts and provider request keys; unknown outcomes stay under review.
4. Roll backend, workers and admin to the last reviewed mutually compatible immutable images. Preserve database state and queue namespaces/idempotency records.
5. Prefer a reviewed forward migration fix. Never drop/reset schema or delete ledger history. Restore/PITR is a separate DBA incident decision because later valid external transfers may exist.
6. Roll provider configuration only with its matching adapter version and secret versions. Reconcile any old/new endpoint ambiguity before resuming.
7. Run health, auth/admin, read-only ledger and reconciliation checks. Re-enable features gradually through audited actions only after owner approval.

No new database migration was added in final setup. Signing/app-store rollback is distribution-version management, not a reason to downgrade API financial contracts without compatibility review. Keep prior signed binaries and image digests in restricted release storage.

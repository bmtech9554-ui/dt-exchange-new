# Financial integrity gate

DT Exchange · Final Production Setup · based on RC1 1.0.0-rc.1

Local fixtures: audited through the full backend regression. Live data: **NOT_VALIDATED**. No financial model, domain calculation, ledger architecture or SQL migration was changed.

Tests cover quote expiry/ownership/single consumption, concurrent order protection, contract/recipient/amount checks, confirmation thresholds, duplicate blockchain handling, exact token units, immutable/balanced journals, stable payout keys, signed webhook replay, success/failed/unknown/reversed payout states, UTR settlement and duplicate referral reward prevention. The RC1 lifecycle fixture produces five journals and zero integrity issues. PGlite concurrency is not independent-connection production proof.

`node backend/scripts/ledger-audit.mjs` uses a consistent read-only snapshot; it exits 2 on integrity issues and 1 when unavailable. Provide the authorized DATABASE_URL before running against staging. Reconcile deposits/orders/ledger/provider amounts, references/UTRs and reversals using the same snapshot. Any imbalance, duplicate effect or critical mismatch blocks release. Preserve history and use authorized reversing entries; never edit settled journals or directly change balance fields.

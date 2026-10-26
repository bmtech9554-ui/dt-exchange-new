-- Staging-only split withdrawal allocation records.
-- No payment processing is enabled by this migration. The application must
-- atomically validate allocation totals, reserve funds once, and enforce
-- admin-reviewed settlement before this table can be used for payouts.
CREATE TABLE manual_payout_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES sell_orders(id),
  user_id uuid NOT NULL REFERENCES users(id),
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id),
  amount_inr_minor bigint NOT NULL CHECK (amount_inr_minor > 0),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED','REVIEW')),
  utr text,
  receipt_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT manual_payout_allocation_bank_unique UNIQUE(order_id,bank_account_id),
  CONSTRAINT manual_payout_allocation_utr_requires_completion CHECK (utr IS NULL OR status IN ('PROCESSING','COMPLETED','REVIEW'))
);
CREATE INDEX manual_payout_allocations_order_idx ON manual_payout_allocations(order_id);
CREATE INDEX manual_payout_allocations_user_idx ON manual_payout_allocations(user_id);
-- Prevent the same transfer reference from being claimed for multiple splits.
CREATE UNIQUE INDEX manual_payout_allocations_utr_unique
 ON manual_payout_allocations(utr) WHERE utr IS NOT NULL;
-- Deliberately no settlement trigger, ledger mutation, payout dispatch, or
-- public endpoint until the full transactional service and tests are reviewed.

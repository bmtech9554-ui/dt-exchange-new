-- Preserve every historical amount; existing rows have zero deposit fee.
ALTER TABLE manual_deposit_requests ADD COLUMN deposit_fee_amount numeric(38,6) NOT NULL DEFAULT 0 CHECK(deposit_fee_amount>=0);
ALTER TABLE manual_deposit_requests ADD COLUMN rate_snapshot jsonb;
ALTER TABLE manual_deposit_requests DROP CONSTRAINT manual_credit_equals_confirmed;
ALTER TABLE manual_deposit_requests ADD CONSTRAINT manual_credit_matches_snapshot CHECK(net_credited_amount IS NULL OR (status='CREDITED' AND net_credited_amount=verified_amount-deposit_fee_amount AND net_credited_amount>0 AND deposit_fee_amount=coalesce((policy_snapshot->>'depositFeeUsdt')::numeric,0)));
CREATE FUNCTION protect_deposit_snapshots() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.policy_snapshot IS NOT NULL AND NEW.policy_snapshot IS DISTINCT FROM OLD.policy_snapshot THEN RAISE EXCEPTION 'Deposit policy snapshot is immutable'; END IF;
 IF NEW.rate_snapshot IS DISTINCT FROM OLD.rate_snapshot THEN RAISE EXCEPTION 'Deposit rate snapshot is immutable'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER manual_snapshots_immutable BEFORE UPDATE ON manual_deposit_requests FOR EACH ROW EXECUTE FUNCTION protect_deposit_snapshots();
CREATE INDEX manual_deposit_review_search ON manual_deposit_requests(status,created_at DESC);

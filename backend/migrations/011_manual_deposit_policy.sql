-- Existing completed records remain untouched; new requests snapshot their policy.
ALTER TABLE manual_deposit_requests ADD COLUMN policy_snapshot jsonb;
ALTER TABLE manual_deposit_requests ADD COLUMN limit_day date;
ALTER TABLE manual_deposit_requests ADD COLUMN net_credited_amount numeric(38,6);
ALTER TABLE manual_deposit_requests ADD CONSTRAINT manual_credit_equals_confirmed CHECK(net_credited_amount IS NULL OR (status='CREDITED' AND net_credited_amount=verified_amount AND net_credited_amount>0));
CREATE INDEX manual_deposit_daily_usage ON manual_deposit_requests(user_id,limit_day);

-- NULL means unconfigured SELL caps, never unlimited. LimitsService fails closed.
ALTER TABLE rate_policies ALTER COLUMN daily_limit DROP NOT NULL;
ALTER TABLE rate_policies ALTER COLUMN monthly_limit DROP NOT NULL;

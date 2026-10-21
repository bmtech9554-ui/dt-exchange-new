ALTER TABLE verification_records DROP CONSTRAINT verification_records_type_check;
ALTER TABLE verification_records ADD CHECK(type IN ('identity','pan','document','selfie','bank','risk'));
ALTER TABLE verification_records ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}';
ALTER TABLE verification_records ADD COLUMN rejection_reason text;
ALTER TABLE bank_accounts ADD COLUMN branch text;
ALTER TABLE bank_accounts ADD COLUMN verification_record_id uuid REFERENCES verification_records(id);
ALTER TABLE otp_challenges ADD COLUMN delivery_status text NOT NULL DEFAULT 'pending' CHECK(delivery_status IN ('pending','sent','failed'));
CREATE INDEX otp_destination_time ON otp_challenges(destination_hash,purpose,created_at DESC);
CREATE INDEX verification_user_type ON verification_records(user_id,type,submitted_at DESC);
CREATE TABLE rate_limit_buckets (
  key text PRIMARY KEY, count integer NOT NULL CHECK(count>0), expires_at timestamptz NOT NULL
);
CREATE INDEX rate_limit_expiry ON rate_limit_buckets(expires_at);
ALTER TABLE rate_policies ADD COLUMN spread_bps integer NOT NULL DEFAULT 0 CHECK(spread_bps BETWEEN 0 AND 9999);
CREATE TABLE user_limits (
 user_id uuid PRIMARY KEY REFERENCES users(id),
 maximum_sell numeric(38,18) NOT NULL CHECK(maximum_sell>0),
 daily_limit numeric(38,18) NOT NULL CHECK(daily_limit>=maximum_sell),
 monthly_limit numeric(38,18) NOT NULL CHECK(monthly_limit>=daily_limit),
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES admin_users(id)
);
-- Keep the original quote money snapshot immutable. Lifecycle is separate.
CREATE TABLE quote_states (
 quote_id uuid PRIMARY KEY REFERENCES quotes(id),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','USED','EXPIRED','CANCELLED')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO quote_states(quote_id,status) SELECT q.id,CASE WHEN o.id IS NOT NULL THEN 'USED' WHEN q.expires_at<=now() THEN 'EXPIRED' ELSE 'ACTIVE' END FROM quotes q LEFT JOIN sell_orders o ON o.quote_id=q.id;
CREATE FUNCTION initialize_quote_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN INSERT INTO quote_states(quote_id) VALUES(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER initialize_quote_state AFTER INSERT ON quotes FOR EACH ROW EXECUTE FUNCTION initialize_quote_state();
CREATE FUNCTION guard_quote_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status<>'ACTIVE' OR NEW.quote_id<>OLD.quote_id OR NEW.status='ACTIVE' THEN
 RAISE EXCEPTION 'Quote lifecycle transition forbidden'; END IF;
 NEW.updated_at:=statement_timestamp(); RETURN NEW;
END $$;
CREATE TRIGGER guard_quote_state BEFORE UPDATE ON quote_states FOR EACH ROW EXECUTE FUNCTION guard_quote_state();
CREATE TRIGGER quote_state_no_delete BEFORE DELETE ON quote_states FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE OR REPLACE FUNCTION validate_order_acceptance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE q quotes;
BEGIN
 SELECT * INTO STRICT q FROM quotes WHERE id=NEW.quote_id FOR UPDATE;
 IF q.expires_at<=statement_timestamp() THEN RAISE EXCEPTION 'Quote expired'; END IF;
 UPDATE quote_states SET status='USED' WHERE quote_id=q.id AND status='ACTIVE';
 IF NOT FOUND THEN RAISE EXCEPTION 'Quote unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND status='active' AND verification_status='verified') THEN RAISE EXCEPTION 'Account ineligible'; END IF;
 IF NOT EXISTS(SELECT 1 FROM bank_accounts WHERE id=NEW.bank_account_id AND user_id=NEW.user_id AND disabled_at IS NULL AND verification_status='verified') THEN RAISE EXCEPTION 'Bank unavailable'; END IF;
 NEW.accepted_at:=statement_timestamp(); RETURN NEW;
END $$;
CREATE INDEX quotes_user_expiry ON quotes(user_id,expires_at);
CREATE FUNCTION protect_fee_policy_terms() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW)-'retired_at') IS DISTINCT FROM (to_jsonb(OLD)-'retired_at') THEN RAISE EXCEPTION 'Create a new policy version'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fees_terms BEFORE UPDATE ON fees FOR EACH ROW EXECUTE FUNCTION protect_fee_policy_terms();
CREATE TRIGGER policy_terms BEFORE UPDATE ON rate_policies FOR EACH ROW EXECUTE FUNCTION protect_fee_policy_terms();

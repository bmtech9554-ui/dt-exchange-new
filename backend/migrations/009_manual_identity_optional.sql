-- Current manual product flow uses active-account, bank, risk and ledger eligibility.
-- Only the backend manual wallet transaction sets this local flag. Automatic paths
-- retain the existing identity gate. No verification record or decision is changed.
CREATE OR REPLACE FUNCTION validate_order_acceptance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE q quotes;
BEGIN
 SELECT * INTO STRICT q FROM quotes WHERE id=NEW.quote_id FOR UPDATE;
 IF q.expires_at<=statement_timestamp() THEN RAISE EXCEPTION 'Quote expired'; END IF;
 UPDATE quote_states SET status='USED' WHERE quote_id=q.id AND status='ACTIVE';
 IF NOT FOUND THEN RAISE EXCEPTION 'Quote unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND status='active' AND (verification_status='verified' OR (NEW.funding_source='wallet' AND current_setting('dt.manual_identity_optional',true)='on'))) THEN RAISE EXCEPTION 'Account ineligible'; END IF;
 IF NOT EXISTS(SELECT 1 FROM bank_accounts WHERE id=NEW.bank_account_id AND user_id=NEW.user_id AND disabled_at IS NULL AND verification_status='verified') THEN RAISE EXCEPTION 'Bank unavailable'; END IF;
 NEW.accepted_at:=statement_timestamp(); RETURN NEW;
END $$;

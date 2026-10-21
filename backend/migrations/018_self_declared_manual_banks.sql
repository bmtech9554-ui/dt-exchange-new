-- Manual payout availability is separate from independent verification.
ALTER TABLE bank_accounts ADD COLUMN self_declared boolean NOT NULL DEFAULT false;
ALTER TABLE bank_accounts DROP CONSTRAINT bank_accounts_check;
ALTER TABLE bank_accounts ADD CONSTRAINT bank_default_available CHECK(
 NOT is_default OR (disabled_at IS NULL AND (verification_status='verified' OR self_declared)));
CREATE FUNCTION protect_self_declared_bank() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.self_declared AND EXISTS(SELECT 1 FROM verification_records WHERE id=NEW.verification_record_id AND provider='synthetic-nonpayable') THEN
  RAISE EXCEPTION 'Synthetic bank cannot become payable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER self_declared_bank_guard BEFORE INSERT OR UPDATE ON bank_accounts
 FOR EACH ROW EXECUTE FUNCTION protect_self_declared_bank();
UPDATE bank_accounts b SET self_declared=true
 FROM verification_records v WHERE v.id=b.verification_record_id
 AND v.provider='manual-review' AND b.verification_status IN ('pending','under_review','required')
 AND b.disabled_at IS NULL AND coalesce(v.metadata->>'nonPayable','false')<>'true';
CREATE OR REPLACE FUNCTION validate_order_acceptance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE q quotes;
BEGIN
 SELECT * INTO STRICT q FROM quotes WHERE id=NEW.quote_id FOR UPDATE;
 IF q.expires_at<=statement_timestamp() THEN RAISE EXCEPTION 'Quote expired'; END IF;
 UPDATE quote_states SET status='USED' WHERE quote_id=q.id AND status='ACTIVE';
 IF NOT FOUND THEN RAISE EXCEPTION 'Quote unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND status='active' AND
  (verification_status='verified' OR (NEW.funding_source='wallet' AND current_setting('dt.manual_identity_optional',true)='on')))
 THEN RAISE EXCEPTION 'Account ineligible'; END IF;
 IF NOT EXISTS(SELECT 1 FROM bank_accounts b WHERE b.id=NEW.bank_account_id AND b.user_id=NEW.user_id AND b.disabled_at IS NULL AND
  (b.verification_status='verified' OR (b.self_declared AND NEW.funding_source='wallet' AND current_setting('dt.manual_identity_optional',true)='on'))
  AND NOT EXISTS(SELECT 1 FROM verification_records v WHERE v.id=b.verification_record_id AND v.provider='synthetic-nonpayable'))
 THEN RAISE EXCEPTION 'Bank unavailable'; END IF;
 NEW.accepted_at:=statement_timestamp(); RETURN NEW;
END $$;

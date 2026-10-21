-- Synthetic physical-validation records can never become financial execution.
CREATE FUNCTION protect_synthetic_deposit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.policy_snapshot->>'synthetic'='true' AND NEW.policy_snapshot->>'synthetic' IS DISTINCT FROM 'true' THEN
  RAISE EXCEPTION 'Synthetic deposit marker is permanent';
 END IF;
 IF NEW.policy_snapshot->>'synthetic'='true' AND (NEW.status IN ('APPROVED','CREDITED') OR NEW.verified_amount IS NOT NULL OR NEW.net_credited_amount IS NOT NULL) THEN
  RAISE EXCEPTION 'Synthetic deposit cannot be confirmed or credited';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER aa_protect_synthetic_deposit BEFORE INSERT OR UPDATE ON manual_deposit_requests FOR EACH ROW EXECUTE FUNCTION protect_synthetic_deposit();
CREATE FUNCTION protect_synthetic_bank() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM verification_records WHERE id=OLD.verification_record_id AND provider='synthetic-nonpayable') AND NEW.verification_record_id IS DISTINCT FROM OLD.verification_record_id THEN
  RAISE EXCEPTION 'Synthetic bank marker is permanent';
 END IF;
 IF NEW.verification_status='verified' AND EXISTS(SELECT 1 FROM verification_records WHERE id=NEW.verification_record_id AND provider='synthetic-nonpayable') THEN
  RAISE EXCEPTION 'Synthetic bank cannot be verified';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_synthetic_bank BEFORE INSERT OR UPDATE ON bank_accounts FOR EACH ROW EXECUTE FUNCTION protect_synthetic_bank();
CREATE FUNCTION prohibit_synthetic_execution() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM bank_accounts b JOIN verification_records v ON v.id=b.verification_record_id WHERE b.id=NEW.bank_account_id AND v.provider='synthetic-nonpayable') THEN
  RAISE EXCEPTION 'Synthetic bank cannot create orders or payouts';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER prohibit_synthetic_order BEFORE INSERT OR UPDATE ON sell_orders FOR EACH ROW EXECUTE FUNCTION prohibit_synthetic_execution();
CREATE TRIGGER prohibit_synthetic_payout BEFORE INSERT OR UPDATE ON payouts FOR EACH ROW EXECUTE FUNCTION prohibit_synthetic_execution();
CREATE FUNCTION protect_synthetic_verification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.provider='synthetic-nonpayable' AND (NEW.provider<>OLD.provider OR NEW.status='verified' OR NEW.metadata->>'nonPayable' IS DISTINCT FROM 'true') THEN
  RAISE EXCEPTION 'Synthetic verification marker is permanent';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_synthetic_verification BEFORE UPDATE ON verification_records FOR EACH ROW EXECUTE FUNCTION protect_synthetic_verification();

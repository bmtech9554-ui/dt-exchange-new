-- Additive Phase 5: retain the existing aggregate, attempts and provider event identities.
ALTER TABLE payouts ADD COLUMN lifecycle text NOT NULL DEFAULT 'CREATED' CHECK(lifecycle IN ('CREATED','QUEUED','SUBMITTED','PROCESSING','SUCCESS','FAILED','REVERSED','CANCELLED','MANUAL_REVIEW')),
 ADD COLUMN sandbox boolean NOT NULL DEFAULT true, ADD COLUMN failure_reason text,
 ADD COLUMN submitted_at timestamptz, ADD COLUMN processed_at timestamptz, ADD COLUMN reversed_at timestamptz,
 ADD COLUMN reversal_reference text, ADD COLUMN last_checked_at timestamptz, ADD COLUMN last_reconciled_at timestamptz;
ALTER TABLE payout_attempts ADD COLUMN lifecycle text NOT NULL DEFAULT 'QUEUED' CHECK(lifecycle IN ('QUEUED','SUBMITTED','PROCESSING','SUCCESS','FAILED','REVERSED','CANCELLED','MANUAL_REVIEW')),
 ADD COLUMN provider text NOT NULL DEFAULT 'mock', ADD COLUMN utr text, ADD COLUMN failure_reason text,
 ADD COLUMN definitive_failure boolean NOT NULL DEFAULT false, ADD COLUMN submission_count integer NOT NULL DEFAULT 0,
 ADD COLUMN submitted_at timestamptz, ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
-- Preserve any existing legacy lifecycle during an upgrade.
UPDATE payouts SET lifecycle=CASE status WHEN 'pending' THEN 'CREATED' ELSE upper(status::text) END;
UPDATE payout_attempts SET lifecycle=CASE status WHEN 'pending' THEN 'QUEUED' ELSE upper(status::text) END;
CREATE UNIQUE INDEX payout_one_active_attempt ON payout_attempts(payout_id) WHERE lifecycle IN ('QUEUED','SUBMITTED','PROCESSING','MANUAL_REVIEW');
CREATE UNIQUE INDEX payout_one_success ON payout_attempts(payout_id) WHERE lifecycle='SUCCESS';
CREATE UNIQUE INDEX payout_attempt_provider_reference ON payout_attempts(provider,provider_ref) WHERE provider_ref IS NOT NULL;
ALTER TABLE provider_events ADD COLUMN event_type text, ADD COLUMN processing_result text;
CREATE TABLE payout_status_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),payout_id uuid NOT NULL REFERENCES payouts(id),attempt_id uuid REFERENCES payout_attempts(id),status text NOT NULL,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER payout_history_immutable BEFORE UPDATE OR DELETE ON payout_status_history FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE TABLE reconciliation_issues(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),payout_id uuid REFERENCES payouts(id),issue_type text NOT NULL,dedupe_key text NOT NULL UNIQUE,status text NOT NULL CHECK(status IN ('MATCHED','MISMATCH','MISSING_INTERNAL','MISSING_PROVIDER','MANUAL_REVIEW','RESOLVED')),safe_context jsonb NOT NULL DEFAULT '{}',detected_at timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz,resolution_notes text);
CREATE INDEX reconciliation_open ON reconciliation_issues(status,detected_at);
CREATE TABLE sandbox_payout_records(request_key text PRIMARY KEY,provider_ref text NOT NULL UNIQUE,amount_inr_minor bigint NOT NULL,status text NOT NULL DEFAULT 'PROCESSING' CHECK(status IN ('PROCESSING','SUCCESS','FAILED','REVERSED')),utr text,failure_code text,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE payout_platform_daily(day date PRIMARY KEY,committed_inr_minor bigint NOT NULL DEFAULT 0 CHECK(committed_inr_minor>=0));
CREATE INDEX payout_poll ON payouts(last_checked_at NULLS FIRST) WHERE lifecycle IN ('SUBMITTED','PROCESSING','MANUAL_REVIEW','SUCCESS');
CREATE FUNCTION payout_lifecycle_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.lifecycle=OLD.lifecycle THEN RETURN NEW; END IF;
 IF NOT ((OLD.lifecycle='CREATED' AND NEW.lifecycle IN ('QUEUED','MANUAL_REVIEW')) OR
 (OLD.lifecycle='QUEUED' AND NEW.lifecycle IN ('SUBMITTED','MANUAL_REVIEW','CANCELLED')) OR
 (OLD.lifecycle IN ('SUBMITTED','PROCESSING','MANUAL_REVIEW') AND NEW.lifecycle IN ('PROCESSING','SUCCESS','FAILED','MANUAL_REVIEW','REVERSED')) OR
 (OLD.lifecycle='FAILED' AND NEW.lifecycle IN ('QUEUED','MANUAL_REVIEW')) OR
 (OLD.lifecycle='SUCCESS' AND NEW.lifecycle IN ('REVERSED','MANUAL_REVIEW'))) THEN RAISE EXCEPTION 'Illegal payout transition'; END IF;
 NEW.updated_at:=statement_timestamp(); RETURN NEW;
END $$;
CREATE TRIGGER payout_lifecycle_guard BEFORE UPDATE ON payouts FOR EACH ROW EXECUTE FUNCTION payout_lifecycle_guard();
CREATE OR REPLACE FUNCTION phase4_order_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor text; actor_kind text; why text;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.wallet_address_id,NEW.required_confirmations,NEW.sandbox) IS DISTINCT FROM ROW(OLD.wallet_address_id,OLD.required_confirmations,OLD.sandbox) THEN RAISE EXCEPTION 'Order funding terms are immutable'; END IF;
  IF NEW.status=OLD.status THEN RETURN NEW; END IF;
  IF NOT ((OLD.status='awaiting_funds' AND NEW.status IN ('detected','funded','expired','cancelled','review','failed')) OR
   (OLD.status='detected' AND NEW.status IN ('confirming','review','failed','expired')) OR
   (OLD.status='confirming' AND NEW.status IN ('funded','review','failed')) OR
   (OLD.status='funded' AND NEW.status IN ('payout_pending','review')) OR
   (OLD.status='payout_pending' AND NEW.status IN ('review','payout_processing')) OR
   (OLD.status='payout_processing' AND NEW.status IN ('completed','failed','review')) OR
   (OLD.status='failed' AND NEW.status='payout_pending') OR
   (OLD.status='completed' AND NEW.status='review') OR
   (OLD.status IN ('expired','cancelled','failed') AND NEW.status='review')) THEN RAISE EXCEPTION 'Illegal Phase 4 order transition'; END IF;
  IF NEW.status='completed' AND NOT EXISTS(SELECT 1 FROM payouts p JOIN ledger_journals j ON j.event_key='payout:'||p.id::text WHERE p.order_id=NEW.id AND p.status='success' AND p.utr IS NOT NULL) THEN RAISE EXCEPTION 'Provider success and settlement required'; END IF;
  IF NEW.status='payout_processing' AND NOT EXISTS(SELECT 1 FROM payouts WHERE order_id=NEW.id AND lifecycle IN ('QUEUED','SUBMITTED','PROCESSING')) THEN RAISE EXCEPTION 'Queued payout required'; END IF;
  NEW.version:=OLD.version+1;NEW.updated_at:=statement_timestamp();
 ELSE
  IF NEW.status<>'awaiting_funds' THEN RAISE EXCEPTION 'Orders start awaiting funds'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION protect_payout_attempt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF ROW(NEW.payout_id,NEW.attempt_number,NEW.provider_request_key,NEW.provider,NEW.started_at) IS DISTINCT FROM ROW(OLD.payout_id,OLD.attempt_number,OLD.provider_request_key,OLD.provider,OLD.started_at) THEN RAISE EXCEPTION 'Payout attempt identity is immutable'; END IF;
 IF OLD.lifecycle IN ('FAILED','CANCELLED','REVERSED') AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Resolved attempt is immutable'; END IF;
 IF OLD.lifecycle='SUCCESS' AND NEW.lifecycle NOT IN ('SUCCESS','REVERSED') THEN RAISE EXCEPTION 'Successful attempt can only reverse'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER payout_attempt_identity BEFORE UPDATE ON payout_attempts FOR EACH ROW EXECUTE FUNCTION protect_payout_attempt();
CREATE TRIGGER payout_attempt_no_delete BEFORE DELETE ON payout_attempts FOR EACH ROW EXECUTE FUNCTION deny_mutation();

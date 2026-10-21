-- Evidence-backed recovery of manual wallet orders. Original journals stay immutable.
CREATE TABLE manual_order_refunds (
 order_id uuid PRIMARY KEY REFERENCES sell_orders(id),
 admin_id uuid NOT NULL REFERENCES admin_users(id),
 receipt_id uuid NOT NULL UNIQUE REFERENCES private_financial_files(id),
 reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 1000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER manual_refunds_immutable BEFORE UPDATE OR DELETE ON manual_order_refunds FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE OR REPLACE FUNCTION phase4_order_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor text; actor_kind text; why text;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.status<>'cancelled' AND EXISTS(SELECT 1 FROM manual_order_refunds WHERE order_id=NEW.id) THEN RAISE EXCEPTION 'Refunded manual orders cannot be reopened'; END IF;
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
   (OLD.status IN ('expired','cancelled','failed') AND NEW.status='review') OR
   (OLD.status='review' AND NEW.status='failed' AND current_setting('dt.transition_reason',true)='MANUAL_CONFIRMED_NO_TRANSFER' AND EXISTS(SELECT 1 FROM payouts WHERE order_id=NEW.id AND provider='manual' AND lifecycle='FAILED' AND failure_code='MANUAL_CONFIRMED_NO_TRANSFER' AND utr IS NULL AND manual_receipt_id IS NULL)) OR
   (OLD.status IN ('review','failed') AND NEW.status='cancelled' AND current_setting('dt.transition_reason',true)='MANUAL_NO_TRANSFER_REFUNDED' AND
    EXISTS(SELECT 1 FROM manual_order_refunds WHERE order_id=NEW.id) AND
    EXISTS(SELECT 1 FROM ledger_journals WHERE event_key='reverse:sell:'||NEW.id) AND
    EXISTS(SELECT 1 FROM ledger_journals WHERE event_key='reverse:reserve:'||NEW.id) AND
    NOT EXISTS(SELECT 1 FROM ledger_journals j WHERE j.event_key='fee:'||NEW.id AND NOT EXISTS(SELECT 1 FROM ledger_journals r WHERE r.reversal_of=j.id)) AND
    NOT EXISTS(SELECT 1 FROM payouts p JOIN ledger_journals j ON j.event_key='payout:'||p.id WHERE p.order_id=NEW.id)) OR
   (OLD.status='review' AND NEW.status='completed' AND
    current_setting('dt.transition_reason',true)='MANUAL_REVIEW_PAYMENT_EVIDENCE_CONFIRMED' AND
    EXISTS(SELECT 1 FROM payouts p WHERE p.order_id=NEW.id AND p.provider='manual'
      AND p.lifecycle='SUCCESS' AND p.manual_receipt_id IS NOT NULL
      AND p.manual_confirmed_by IS NOT NULL AND p.manual_paid_at IS NOT NULL)
   )) THEN RAISE EXCEPTION 'Illegal Phase 4 order transition'; END IF;
  IF NEW.status='completed' AND NOT EXISTS(SELECT 1 FROM payouts p JOIN ledger_journals j ON j.event_key='payout:'||p.id::text WHERE p.order_id=NEW.id AND p.status='success' AND p.utr IS NOT NULL) THEN RAISE EXCEPTION 'Provider success and settlement required'; END IF;
  IF NEW.status='payout_processing' AND NOT EXISTS(SELECT 1 FROM payouts WHERE order_id=NEW.id AND lifecycle IN ('QUEUED','SUBMITTED','PROCESSING')) THEN RAISE EXCEPTION 'Queued payout required'; END IF;
  NEW.version:=OLD.version+1;NEW.updated_at:=statement_timestamp();
 ELSE
  IF NEW.status<>'awaiting_funds' THEN RAISE EXCEPTION 'Orders start awaiting funds'; END IF;
 END IF;
 RETURN NEW;
END $$;

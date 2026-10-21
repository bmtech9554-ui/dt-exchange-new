-- Phase 4 additive transaction foundation. Earlier migrations remain untouched.
ALTER TABLE sell_orders ADD COLUMN wallet_address_id uuid UNIQUE REFERENCES wallet_addresses(id);
ALTER TABLE sell_orders ADD COLUMN required_confirmations integer CHECK(required_confirmations>0);
ALTER TABLE sell_orders ADD COLUMN sandbox boolean NOT NULL DEFAULT false;
ALTER TABLE sell_orders ADD COLUMN review_reason text;
ALTER TABLE wallet_addresses ADD COLUMN purpose text NOT NULL DEFAULT 'wallet' CHECK(purpose IN ('wallet','order'));
ALTER TABLE wallet_addresses ADD COLUMN allocation_key text UNIQUE;
CREATE UNIQUE INDEX wallet_primary_address ON wallet_addresses(wallet_id,network_code) WHERE purpose='wallet' AND retired_at IS NULL;
ALTER TABLE blockchain_transactions ADD COLUMN required_confirmations integer NOT NULL DEFAULT 20 CHECK(required_confirmations>0);
ALTER TABLE blockchain_transactions ADD COLUMN last_checked_at timestamptz;
ALTER TABLE blockchain_transactions ADD COLUMN rejection_reason text;
-- Multiple log records remain possible for audit, but a hash may fund at most one deposit automatically.
CREATE UNIQUE INDEX chain_one_confirmed_hash ON blockchain_transactions(network_code,tx_hash) WHERE status='confirmed';
CREATE INDEX chain_recipient_status ON blockchain_transactions(receiver,status,observed_at);
CREATE INDEX allocations_deposit ON order_deposit_allocations(deposit_id);
CREATE INDEX sell_address ON sell_orders(wallet_address_id,status);
ALTER TABLE risk_flags ADD COLUMN dedupe_key text UNIQUE;
CREATE TABLE order_status_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES sell_orders(id),
 from_status sell_status,to_status sell_status NOT NULL,reason text NOT NULL,
 actor_type text NOT NULL CHECK(actor_type IN ('user','admin','service')),actor_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL,UNIQUE(order_id,version)
);
CREATE TRIGGER order_history_immutable BEFORE UPDATE OR DELETE ON order_status_history FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE TRIGGER order_history_no_truncate BEFORE TRUNCATE ON order_status_history FOR EACH STATEMENT EXECUTE FUNCTION deny_mutation();
CREATE TABLE chain_scan_cursors (
 wallet_address_id uuid PRIMARY KEY REFERENCES wallet_addresses(id),cursor jsonb NOT NULL DEFAULT '{}',
 last_scheduled_at timestamptz,last_scan_at timestamptz,version integer NOT NULL DEFAULT 0
);
CREATE TABLE worker_failures (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),job_id text NOT NULL UNIQUE,job_name text NOT NULL,
 safe_context jsonb NOT NULL DEFAULT '{}',failure_code text NOT NULL,attempts integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz
);
CREATE INDEX worker_failures_open ON worker_failures(created_at) WHERE resolved_at IS NULL;
CREATE FUNCTION phase4_order_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor text; actor_kind text; why text;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.wallet_address_id,NEW.required_confirmations,NEW.sandbox) IS DISTINCT FROM ROW(OLD.wallet_address_id,OLD.required_confirmations,OLD.sandbox) THEN RAISE EXCEPTION 'Order funding terms are immutable'; END IF;
  IF NEW.status=OLD.status THEN RETURN NEW; END IF;
  IF NOT ((OLD.status='awaiting_funds' AND NEW.status IN ('detected','funded','expired','cancelled','review','failed')) OR
   (OLD.status='detected' AND NEW.status IN ('confirming','review','failed','expired')) OR
   (OLD.status='confirming' AND NEW.status IN ('funded','review','failed')) OR
   (OLD.status='funded' AND NEW.status IN ('payout_pending','review')) OR
   (OLD.status='payout_pending' AND NEW.status='review') OR
   (OLD.status IN ('expired','cancelled','failed') AND NEW.status='review')) THEN RAISE EXCEPTION 'Illegal Phase 4 order transition'; END IF;
  NEW.version:=OLD.version+1;NEW.updated_at:=statement_timestamp();
 ELSE
  IF NEW.status<>'awaiting_funds' THEN RAISE EXCEPTION 'Orders start awaiting funds'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER phase4_order_transition BEFORE INSERT OR UPDATE ON sell_orders FOR EACH ROW EXECUTE FUNCTION phase4_order_transition();
CREATE FUNCTION phase4_order_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor text; actor_kind text; why text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.status=OLD.status THEN RETURN NULL; END IF;
 actor:=coalesce(nullif(current_setting('dt.actor_id',true),''),'database');
 actor_kind:=coalesce(nullif(current_setting('dt.actor_type',true),''),'service');
 why:=coalesce(nullif(current_setting('dt.transition_reason',true),''),'SERVER_TRANSITION');
 INSERT INTO order_status_history(order_id,from_status,to_status,reason,actor_type,actor_id,version)
 VALUES(NEW.id,CASE WHEN TG_OP='UPDATE' THEN OLD.status ELSE NULL END,NEW.status,why,actor_kind,actor,NEW.version);
 INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes)
 VALUES(actor_kind,actor,'order.transition','order',NEW.id::text,gen_random_uuid(),jsonb_build_object('status',NEW.status,'reason',why,'version',NEW.version));
 RETURN NULL;
END $$;
CREATE TRIGGER phase4_order_history AFTER INSERT OR UPDATE ON sell_orders FOR EACH ROW EXECUTE FUNCTION phase4_order_history();
CREATE FUNCTION phase4_order_address() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.wallet_address_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM wallet_addresses a WHERE a.id=NEW.wallet_address_id AND a.user_id=NEW.user_id AND a.asset_symbol='USDT' AND a.purpose='order') THEN RAISE EXCEPTION 'Order address ownership mismatch';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER phase4_order_address BEFORE INSERT ON sell_orders FOR EACH ROW EXECUTE FUNCTION phase4_order_address();
INSERT INTO admin_permissions(code,description) VALUES('deposits.read','Read blockchain deposit evidence'),('reviews.read','Read transaction review queue'),('reviews.acknowledge','Acknowledge a review with a reason; cannot credit funds') ON CONFLICT DO NOTHING;
INSERT INTO admin_role_permissions(role_id,permission_code) SELECT id,p FROM admin_roles CROSS JOIN unnest(ARRAY['orders.read','deposits.read','reviews.read','reviews.acknowledge']) p WHERE name='operations' ON CONFLICT DO NOTHING;
ALTER TABLE admin_users ADD COLUMN last_totp_step bigint;

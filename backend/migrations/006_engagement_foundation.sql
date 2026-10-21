-- Additive engagement domain; existing financial terms and entries remain immutable.
ALTER TABLE notifications ADD COLUMN dedupe_key text UNIQUE, ADD COLUMN category text NOT NULL DEFAULT 'SYSTEM', ADD COLUMN deep_link text, ADD COLUMN archived_at timestamptz;
CREATE TABLE notification_devices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES users(id),session_family_id uuid NOT NULL,token_hash text NOT NULL UNIQUE,token_ciphertext bytea NOT NULL,platform text NOT NULL CHECK(platform IN ('ANDROID','IOS','WEB')),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz);
CREATE TABLE notification_deliveries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),notification_id uuid NOT NULL REFERENCES notifications(id),channel text NOT NULL CHECK(channel IN ('IN_APP','PUSH','EMAIL','SMS')),device_id uuid REFERENCES notification_devices(id),destination_key text NOT NULL,provider text NOT NULL,status text NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','SENT','DELIVERED','FAILED','SKIPPED')),provider_ref text,attempt_count integer NOT NULL DEFAULT 0,last_attempt_at timestamptz,next_attempt_at timestamptz NOT NULL DEFAULT now(),lease_until timestamptz,failure_reason text,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(notification_id,channel,destination_key));
CREATE INDEX notification_delivery_queue ON notification_deliveries(status,next_attempt_at);
CREATE TABLE announcements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,message text NOT NULL,audience text NOT NULL CHECK(audience IN ('ALL_USERS','VERIFIED_USERS','SPECIFIC_USERS')),user_ids uuid[] NOT NULL DEFAULT '{}',starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,priority text NOT NULL CHECK(priority IN ('NORMAL','IMPORTANT')),published boolean NOT NULL DEFAULT false,created_by uuid NOT NULL REFERENCES admin_users(id),created_at timestamptz NOT NULL DEFAULT now(),CHECK(ends_at>starts_at),CHECK(cardinality(user_ids)<=100));
ALTER TABLE user_profiles ADD COLUMN app_preferences jsonb NOT NULL DEFAULT '{}',ADD COLUMN pin_failures integer NOT NULL DEFAULT 0,ADD COLUMN pin_locked_until timestamptz;
CREATE TABLE account_deletion_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL UNIQUE REFERENCES users(id),status text NOT NULL DEFAULT 'DELETION_REQUESTED' CHECK(status IN ('DELETION_REQUESTED','DEACTIVATED')),created_at timestamptz NOT NULL DEFAULT now(),reason_ciphertext bytea);
ALTER TABLE referrals ADD COLUMN lifecycle text NOT NULL DEFAULT 'REGISTERED' CHECK(lifecycle IN ('INVITED','REGISTERED','QUALIFIED','REWARDED','REJECTED')),ADD COLUMN rule_snapshot jsonb,ADD COLUMN qualified_order_id uuid REFERENCES sell_orders(id),ADD COLUMN review_required boolean NOT NULL DEFAULT false,ADD COLUMN rejection_code text,ADD COLUMN reward_checked_at timestamptz;
ALTER TABLE ledger_journals DROP CONSTRAINT ledger_journals_event_type_check;
ALTER TABLE ledger_journals ADD CONSTRAINT ledger_journals_event_type_check CHECK(event_type IN ('deposit','reserve','sell','fee','payout','adjustment','reversal','referral'));
ALTER TABLE support_tickets DROP CONSTRAINT support_tickets_status_check;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_status_check CHECK(status IN ('open','in_progress','waiting_for_user','resolved','closed'));
ALTER TABLE support_tickets ADD COLUMN category text NOT NULL DEFAULT 'OTHER',ADD COLUMN priority text NOT NULL DEFAULT 'NORMAL' CHECK(priority IN ('NORMAL','HIGH')),ADD COLUMN order_id uuid REFERENCES sell_orders(id),ADD COLUMN payout_id uuid REFERENCES payouts(id),ADD COLUMN escalated_at timestamptz;
CREATE TABLE support_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id uuid NOT NULL REFERENCES support_tickets(id),author_type text NOT NULL CHECK(author_type IN ('USER','ADMIN')),author_id uuid NOT NULL,message_ciphertext bytea NOT NULL,internal boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX support_thread ON support_messages(ticket_id,created_at);
CREATE TABLE support_attachments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id uuid NOT NULL REFERENCES support_tickets(id),user_id uuid NOT NULL REFERENCES users(id),mime_type text NOT NULL,size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 5242880),storage_key text NOT NULL UNIQUE,status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','QUARANTINED','AVAILABLE','REJECTED')),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE help_articles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),category text NOT NULL,question text NOT NULL,answer text NOT NULL,published boolean NOT NULL DEFAULT false,sort_order integer NOT NULL DEFAULT 0,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE worker_heartbeats(worker text PRIMARY KEY,last_seen_at timestamptz NOT NULL DEFAULT now(),state text NOT NULL);
CREATE TABLE provider_circuits(provider text PRIMARY KEY,failures integer NOT NULL DEFAULT 0,opened_until timestamptz);
CREATE TABLE metric_samples(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,name text NOT NULL,value numeric NOT NULL,labels jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX metric_samples_time ON metric_samples(created_at);
-- Atomic notifications for existing business writes; no financial calculations change.
CREATE FUNCTION engagement_notify(uid uuid,event_key text,kind text,title text,message text,target text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO notifications(user_id,type,title,body,data,dedupe_key,category,deep_link) VALUES(uid,lower(kind),title,message,jsonb_build_object('route',target),event_key,kind,target) ON CONFLICT(dedupe_key) DO NOTHING;
END $$;
CREATE FUNCTION engagement_domain_events() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE uid uuid; BEGIN
 IF TG_TABLE_NAME='sessions' THEN
  IF NEW.rotated_from IS NULL AND NOT EXISTS(SELECT 1 FROM sessions WHERE user_id=NEW.user_id AND device_id_hash=NEW.device_id_hash AND id<>NEW.id) THEN PERFORM engagement_notify(NEW.user_id,'new-device:'||NEW.id,'SECURITY','New device signed in','A new device signed in to your account. Review your login devices.','/settings/devices'); END IF;
 ELSIF TG_TABLE_NAME='bank_accounts' THEN
  IF TG_OP='INSERT' THEN PERFORM engagement_notify(NEW.user_id,'bank-added:'||NEW.id,'ACCOUNT','Bank account added','Your payout bank account has been added.','/banks'); END IF;
  IF NEW.verification_status='verified' AND (TG_OP='INSERT' OR OLD.verification_status IS DISTINCT FROM NEW.verification_status) THEN PERFORM engagement_notify(NEW.user_id,'bank-verified:'||NEW.id,'ACCOUNT','Bank account verified','Your bank account is ready for eligible payouts.','/banks'); END IF;
 ELSIF TG_TABLE_NAME='users' THEN
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN PERFORM engagement_notify(NEW.id,'verification:'||NEW.id||':'||txid_current(),'ACCOUNT','Verification status updated','Your account verification status has changed.','/profile'); END IF;
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN PERFORM engagement_notify(NEW.id,'password:'||NEW.id||':'||txid_current(),'SECURITY','Password changed','Your password has changed. Contact support if this was not you.','/support'); END IF;
 ELSIF TG_TABLE_NAME='sell_orders' THEN
  PERFORM engagement_notify(NEW.user_id,'order-created:'||NEW.id,'SELL_ORDER','Sell order created','Your accepted rate is locked. Track your exchange.','/sell/track/'||NEW.id);
 ELSIF TG_TABLE_NAME='deposits' THEN
  IF TG_OP='INSERT' THEN PERFORM engagement_notify(NEW.user_id,'deposit-detected:'||NEW.id,'DEPOSIT','USDT deposit detected','Your deposit is awaiting blockchain confirmation.','/history/'||NEW.id);
  ELSIF NEW.status='credited' AND OLD.status<>NEW.status THEN PERFORM engagement_notify(NEW.user_id,'deposit-confirmed:'||NEW.id,'BLOCKCHAIN','USDT deposit confirmed','Required blockchain confirmations have been received.','/history/'||NEW.id); END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER engagement_sessions AFTER INSERT ON sessions FOR EACH ROW EXECUTE FUNCTION engagement_domain_events();
CREATE TRIGGER engagement_banks AFTER INSERT OR UPDATE ON bank_accounts FOR EACH ROW EXECUTE FUNCTION engagement_domain_events();
CREATE TRIGGER engagement_users AFTER UPDATE ON users FOR EACH ROW EXECUTE FUNCTION engagement_domain_events();
CREATE TRIGGER engagement_orders AFTER INSERT ON sell_orders FOR EACH ROW EXECUTE FUNCTION engagement_domain_events();
CREATE TRIGGER engagement_deposits AFTER INSERT OR UPDATE ON deposits FOR EACH ROW EXECUTE FUNCTION engagement_domain_events();

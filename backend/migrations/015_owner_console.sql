-- Explicit owner capabilities; assignment to an existing account is a separately audited deployment step.
INSERT INTO admin_permissions(code,description) VALUES
 ('owner.console','Use the owner operations console'),('users.edit','Edit user contact/profile with audit and session revocation'),
 ('banks.manage','Correct eligible bank records without altering accepted beneficiaries'),
 ('wallets.adjust','Post explicit balanced, immutable USDT adjustments'),
 ('deposits.amend','Amend pending manual evidence with retained TxID claims'),
 ('public.settings','Manage safe website/app configuration'),('maintenance.manage','Manage independent maintenance controls'),
 ('admins.read','Read administrator roles and capability assignments') ON CONFLICT DO NOTHING;
INSERT INTO admin_roles(name,description) VALUES('OWNER_ADMIN','Explicit platform owner capabilities; MFA required; no authorization bypass') ON CONFLICT DO NOTHING;
INSERT INTO admin_role_permissions(role_id,permission_code)
SELECT r.id,p.code FROM admin_roles r JOIN admin_permissions p ON p.code=ANY(ARRAY[
 'owner.console','dashboard.read','users.read','users.manage','users.edit','banks.read','banks.manage',
 'wallets.read','wallets.adjust','audit.read','settings.read','settings.write','providers.read','system.monitor',
 'orders.read','deposits.read','reviews.read','reviews.acknowledge','DEPOSIT_REVIEW','DEPOSIT_APPROVE','deposits.amend',
 'PAYOUT_VIEW','PAYOUT_PROCESS','PAYOUT_CONFIRM','payouts.read','payouts.review','reconciliation.read','reconciliation.resolve',
 'support.write','support.faq','referrals.read','referrals.review','referrals.rules','notifications.manage','notifications.publish',
 'ANDROID_RELEASE_PUBLISH','public.settings','maintenance.manage','admins.read']) WHERE r.name='OWNER_ADMIN' ON CONFLICT DO NOTHING;
-- No SUPER_ADMIN, FINANCIAL_ADMIN, provider retry, or automatic-execution permission is inferred.
ALTER TABLE users ADD COLUMN admin_version integer NOT NULL DEFAULT 1;
ALTER TABLE bank_accounts ADD COLUMN admin_version integer NOT NULL DEFAULT 1, ADD COLUMN account_type text CHECK(account_type IN ('savings','current','other'));
ALTER TABLE manual_deposit_requests ADD COLUMN admin_version integer NOT NULL DEFAULT 1;
CREATE TABLE owner_user_notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES users(id),admin_id uuid NOT NULL REFERENCES admin_users(id),body_ciphertext bytea NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER owner_notes_immutable BEFORE UPDATE OR DELETE ON owner_user_notes FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE TABLE owner_wallet_adjustments(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id),admin_id uuid NOT NULL REFERENCES admin_users(id),amount numeric(38,6) NOT NULL CHECK(amount>0),direction text NOT NULL CHECK(direction IN ('credit','debit')),reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 500),created_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER owner_adjustments_immutable BEFORE UPDATE OR DELETE ON owner_wallet_adjustments FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE TABLE owner_deposit_amendments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL REFERENCES manual_deposit_requests(id),admin_id uuid NOT NULL REFERENCES admin_users(id),transaction_id bigint NOT NULL DEFAULT txid_current(),before_values jsonb NOT NULL,after_values jsonb NOT NULL,reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 500),created_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER owner_deposit_amendments_immutable BEFORE UPDATE OR DELETE ON owner_deposit_amendments FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE TABLE manual_deposit_txid_claims(network_code text NOT NULL,tx_hash text NOT NULL,request_id uuid NOT NULL REFERENCES manual_deposit_requests(id),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(network_code,tx_hash));
INSERT INTO manual_deposit_txid_claims(network_code,tx_hash,request_id) SELECT network_code,tx_hash,id FROM manual_deposit_requests;
CREATE TRIGGER manual_txid_claims_immutable BEFORE UPDATE OR DELETE ON manual_deposit_txid_claims FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE FUNCTION retain_manual_txid_claim() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM manual_deposit_txid_claims WHERE network_code=NEW.network_code AND tx_hash=NEW.tx_hash AND request_id<>NEW.id) THEN RAISE EXCEPTION 'Transaction already claimed'; END IF;
 INSERT INTO manual_deposit_txid_claims(network_code,tx_hash,request_id) VALUES(NEW.network_code,NEW.tx_hash,NEW.id) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER retain_manual_txid AFTER INSERT OR UPDATE OF tx_hash ON manual_deposit_requests FOR EACH ROW EXECUTE FUNCTION retain_manual_txid_claim();
CREATE OR REPLACE FUNCTION protect_manual_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.status='CREDITED' AND (NEW.verified_amount IS NULL OR NEW.verified_amount<=0 OR NEW.reviewer_id IS NULL OR NEW.verification IS NULL OR NOT EXISTS(SELECT 1 FROM ledger_journals WHERE event_key='deposit:'||NEW.network_code||':'||NEW.tx_hash)) THEN RAISE EXCEPTION 'Ledger and verified evidence required'; END IF;
 IF OLD.status IN ('CREDITED','APPROVED') THEN RAISE EXCEPTION 'Approved proof immutable'; END IF;
 IF ROW(NEW.user_id,NEW.network_code,NEW.receiver) IS DISTINCT FROM ROW(OLD.user_id,OLD.network_code,OLD.receiver) THEN RAISE EXCEPTION 'Proof owner and destination immutable'; END IF;
 IF ROW(NEW.tx_hash,NEW.submitted_amount) IS DISTINCT FROM ROW(OLD.tx_hash,OLD.submitted_amount) THEN
  IF OLD.status<>'UNDER_REVIEW' OR NEW.status<>'UNDER_REVIEW' OR NOT EXISTS(
   SELECT 1 FROM owner_deposit_amendments a JOIN admin_user_roles u ON u.admin_user_id=a.admin_id JOIN admin_role_permissions p ON p.role_id=u.role_id AND p.permission_code='deposits.amend'
   WHERE a.request_id=OLD.id AND a.transaction_id=txid_current()
   AND a.before_values->>'txHash'=OLD.tx_hash AND (a.before_values->>'submittedAmount')::numeric=OLD.submitted_amount
   AND a.after_values->>'txHash'=NEW.tx_hash AND (a.after_values->>'submittedAmount')::numeric=NEW.submitted_amount
  ) THEN RAISE EXCEPTION 'Pending evidence amendment and authorization required'; END IF;
 END IF;
 RETURN NEW; END $$;
INSERT INTO system_settings(key,value) VALUES
 ('owner_public_config','{"telegram":"dtexchange","contactEmail":"","announcement":"","informationalText":"","downloadVisible":true}'),
 ('owner_maintenance','{"app":false,"website":false,"api":false,"message":"DT Exchange is temporarily under maintenance. Please try again shortly.","scheduledAt":null,"startedAt":null}') ON CONFLICT DO NOTHING;
CREATE INDEX owner_user_notes_user ON owner_user_notes(user_id,created_at DESC);
CREATE INDEX owner_amendments_request ON owner_deposit_amendments(request_id,created_at DESC);
CREATE FUNCTION owner_row_version() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.admin_version=OLD.admin_version+1; RETURN NEW; END $$;
CREATE TRIGGER owner_user_version BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION owner_row_version();
CREATE TRIGGER owner_bank_version BEFORE UPDATE ON bank_accounts FOR EACH ROW EXECUTE FUNCTION owner_row_version();
CREATE TRIGGER owner_deposit_version BEFORE UPDATE ON manual_deposit_requests FOR EACH ROW EXECUTE FUNCTION owner_row_version();

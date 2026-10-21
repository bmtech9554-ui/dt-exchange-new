-- Additive manual evidence/review domain; existing accounting and provider tables retained.
CREATE TABLE private_financial_files(id uuid PRIMARY KEY,user_id uuid REFERENCES users(id),admin_id uuid REFERENCES admin_users(id),purpose text NOT NULL CHECK(purpose IN ('proof','receipt')),mime text NOT NULL CHECK(mime IN ('image/jpeg','image/png','application/pdf')),size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 5242880),sha256 text NOT NULL,payload_ciphertext bytea NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE manual_deposit_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES users(id),network_code text NOT NULL,tx_hash text NOT NULL CHECK(tx_hash ~ '^[a-f0-9]{64}$'),submitted_amount numeric(38,6) NOT NULL CHECK(submitted_amount>0),receiver text NOT NULL,sender text,transaction_time timestamptz,proof_id uuid REFERENCES private_financial_files(id),note text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'PROOF_SUBMITTED' CHECK(status IN ('PROOF_SUBMITTED','UNDER_REVIEW','REQUIRES_MORE_INFORMATION','APPROVED','REJECTED','CREDITED','CANCELLED')),verified_amount numeric(38,6),reviewer_id uuid REFERENCES admin_users(id),verification jsonb,reason text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(network_code,tx_hash));
CREATE TABLE manual_action_history(sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entity_id uuid NOT NULL,user_id uuid NOT NULL REFERENCES users(id),actor_id text NOT NULL,from_status text,to_status text NOT NULL,note text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER manual_history_immutable BEFORE UPDATE OR DELETE ON manual_action_history FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE TRIGGER financial_files_immutable BEFORE UPDATE OR DELETE ON private_financial_files FOR EACH ROW EXECUTE FUNCTION deny_mutation();
ALTER TABLE payouts ADD COLUMN manual_receipt_id uuid REFERENCES private_financial_files(id),ADD COLUMN manual_paid_at timestamptz,ADD COLUMN manual_confirmed_by uuid REFERENCES admin_users(id),ADD COLUMN manual_bank_used text,ADD COLUMN manual_note text;
CREATE UNIQUE INDEX manual_utr_unique ON payouts(utr) WHERE provider='manual' AND utr IS NOT NULL;
CREATE TABLE android_releases(version_code integer PRIMARY KEY CHECK(version_code>0),version_name text NOT NULL,minimum_version_code integer NOT NULL CHECK(minimum_version_code>0 AND minimum_version_code<=version_code),apk_url text NOT NULL,download_url text NOT NULL,sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),certificate_sha256 text NOT NULL CHECK(certificate_sha256 ~ '^[a-f0-9]{64}$'),size_bytes bigint NOT NULL CHECK(size_bytes>0),release_notes text NOT NULL,mandatory boolean NOT NULL DEFAULT false,attestation text NOT NULL,active boolean NOT NULL DEFAULT false,published_by uuid NOT NULL REFERENCES admin_users(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX android_one_active ON android_releases(active) WHERE active;
INSERT INTO admin_permissions(code,description) VALUES ('DEPOSIT_REVIEW','Review private deposit proofs'),('DEPOSIT_APPROVE','Approve verified deposits'),('PAYOUT_VIEW','View masked manual payouts'),('PAYOUT_PROCESS','Process manual payout and reveal beneficiary'),('PAYOUT_CONFIRM','Confirm evidenced manual bank payment'),('FINANCIAL_ADMIN','Publish signed Android release metadata') ON CONFLICT DO NOTHING;
INSERT INTO admin_roles(name,description) VALUES ('manual-deposit-reviewer','Manual deposit review'),('manual-deposit-approver','Manual deposit approval'),('manual-payout-operator','Manual bank payout'),('manual-financial-admin','Manual financial operations and signed releases') ON CONFLICT DO NOTHING;
INSERT INTO admin_role_permissions(role_id,permission_code) SELECT id,p FROM admin_roles CROSS JOIN unnest(ARRAY['DEPOSIT_REVIEW','DEPOSIT_APPROVE','PAYOUT_VIEW','PAYOUT_PROCESS','PAYOUT_CONFIRM','FINANCIAL_ADMIN']) p WHERE name='manual-financial-admin' ON CONFLICT DO NOTHING;
INSERT INTO admin_role_permissions(role_id,permission_code) SELECT id,'DEPOSIT_REVIEW' FROM admin_roles WHERE name IN ('manual-deposit-reviewer','manual-deposit-approver') ON CONFLICT DO NOTHING;
INSERT INTO admin_role_permissions(role_id,permission_code) SELECT id,'DEPOSIT_APPROVE' FROM admin_roles WHERE name='manual-deposit-approver' ON CONFLICT DO NOTHING;
INSERT INTO admin_role_permissions(role_id,permission_code) SELECT id,p FROM admin_roles CROSS JOIN unnest(ARRAY['PAYOUT_VIEW','PAYOUT_PROCESS','PAYOUT_CONFIRM']) p WHERE name='manual-payout-operator' ON CONFLICT DO NOTHING;
CREATE FUNCTION protect_manual_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.status='CREDITED' AND (NEW.verified_amount IS NULL OR NEW.verified_amount<=0 OR NEW.reviewer_id IS NULL OR NEW.verification IS NULL OR NOT EXISTS(SELECT 1 FROM ledger_journals WHERE event_key='deposit:'||NEW.network_code||':'||NEW.tx_hash)) THEN RAISE EXCEPTION 'Ledger and verified evidence required'; END IF;
 IF OLD.status='CREDITED' THEN RAISE EXCEPTION 'Credited proof immutable'; END IF;
 IF ROW(NEW.user_id,NEW.network_code,NEW.tx_hash,NEW.receiver,NEW.submitted_amount) IS DISTINCT FROM ROW(OLD.user_id,OLD.network_code,OLD.tx_hash,OLD.receiver,OLD.submitted_amount) THEN RAISE EXCEPTION 'Proof identity immutable'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER manual_evidence_identity BEFORE UPDATE ON manual_deposit_requests FOR EACH ROW EXECUTE FUNCTION protect_manual_evidence();
CREATE TRIGGER manual_evidence_no_delete BEFORE DELETE ON manual_deposit_requests FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE INDEX manual_review_queue ON manual_deposit_requests(status,created_at);

CREATE FUNCTION protect_android_release() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (to_jsonb(NEW)-'active') IS DISTINCT FROM (to_jsonb(OLD)-'active') THEN RAISE EXCEPTION 'Release evidence immutable'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER android_release_immutable BEFORE UPDATE ON android_releases FOR EACH ROW EXECUTE FUNCTION protect_android_release();
CREATE TRIGGER android_release_no_delete BEFORE DELETE ON android_releases FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE INDEX manual_user_history ON manual_deposit_requests(user_id,created_at DESC);
CREATE INDEX manual_action_entity ON manual_action_history(entity_id,created_at);

ALTER TABLE private_financial_files ADD CONSTRAINT financial_file_owner CHECK ((user_id IS NULL) <> (admin_id IS NULL));
CREATE UNIQUE INDEX manual_receipt_once ON payouts(manual_receipt_id) WHERE manual_receipt_id IS NOT NULL;

CREATE FUNCTION protect_manual_payout_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.provider='manual' AND NEW.lifecycle='SUCCESS' AND (NEW.manual_receipt_id IS NULL OR NEW.manual_paid_at IS NULL OR NEW.manual_confirmed_by IS NULL OR NEW.utr IS NULL OR NOT EXISTS(SELECT 1 FROM private_financial_files WHERE id=NEW.manual_receipt_id AND purpose='receipt')) THEN RAISE EXCEPTION 'Manual payout evidence required'; END IF;
 IF OLD.provider='manual' AND OLD.lifecycle='SUCCESS' AND ROW(NEW.utr,NEW.manual_receipt_id,NEW.manual_paid_at,NEW.manual_confirmed_by,NEW.manual_bank_used,NEW.manual_note) IS DISTINCT FROM ROW(OLD.utr,OLD.manual_receipt_id,OLD.manual_paid_at,OLD.manual_confirmed_by,OLD.manual_bank_used,OLD.manual_note) THEN RAISE EXCEPTION 'Manual payment evidence immutable'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER manual_payout_evidence BEFORE UPDATE ON payouts FOR EACH ROW EXECUTE FUNCTION protect_manual_payout_evidence();

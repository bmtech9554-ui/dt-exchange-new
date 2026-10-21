-- DT Exchange Phase 1. PostgreSQL 16+. Migrations run in one transaction.
-- No balances stored on users/wallets; ledger entries are the monetary source.
CREATE TYPE account_status AS ENUM ('pending','active','frozen','suspended','closed');
CREATE TYPE verification_status AS ENUM ('required','pending','verified','rejected','expired');
CREATE TYPE funding_source AS ENUM ('wallet','onchain');
CREATE TYPE sell_status AS ENUM ('awaiting_funds','detected','confirming','funded','payout_pending','payout_processing','completed','expired','cancelled','review','failed');
CREATE TYPE chain_status AS ENUM ('detected','confirming','confirmed','reorged','rejected');
CREATE TYPE payout_status AS ENUM ('pending','processing','success','failed','reversed');
CREATE TYPE entry_side AS ENUM ('debit','credit');
CREATE TYPE rate_mode AS ENUM ('manual','market','market_plus_margin','market_minus_margin');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_ciphertext bytea, email_lookup_hash text UNIQUE,
  mobile_ciphertext bytea, mobile_lookup_hash text UNIQUE,
  password_hash text,
  status account_status NOT NULL DEFAULT 'pending',
  verification_status verification_status NOT NULL DEFAULT 'required',
  email_verified_at timestamptz, mobile_verified_at timestamptz,
  terms_version text NOT NULL, terms_accepted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CHECK (email_lookup_hash IS NOT NULL OR mobile_lookup_hash IS NOT NULL),
  CHECK ((email_lookup_hash IS NULL) = (email_ciphertext IS NULL)),
  CHECK ((mobile_lookup_hash IS NULL) = (mobile_ciphertext IS NULL))
);
CREATE TABLE user_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  full_name_ciphertext bytea NOT NULL,
  avatar_object_key text, locale text NOT NULL DEFAULT 'en-IN',
  time_zone text NOT NULL DEFAULT 'Asia/Kolkata',
  security_pin_hash text, totp_secret_ciphertext bytea, totp_enabled_at timestamptz,
  notification_preferences jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  family_id uuid NOT NULL, refresh_token_hash text NOT NULL UNIQUE,
  rotated_from uuid UNIQUE REFERENCES sessions(id), device_id_hash text NOT NULL,
  device_label text, ip_hash text, user_agent_hash text,
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, revoke_reason text,
  CHECK (expires_at > created_at)
);
CREATE INDEX sessions_user_active ON sessions(user_id,expires_at) WHERE revoked_at IS NULL;
CREATE INDEX sessions_family ON sessions(family_id);
CREATE TABLE otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id),
  destination_hash text NOT NULL, purpose text NOT NULL,
  code_hash text NOT NULL, attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  expires_at timestamptz NOT NULL, consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id),
  destination_hash text, success boolean NOT NULL, reason_code text,
  ip_hash text, device_id_hash text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_history_user_date ON login_history(user_id,created_at DESC);

CREATE TABLE admin_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, description text NOT NULL);
CREATE TABLE admin_permissions (code text PRIMARY KEY, description text NOT NULL);
CREATE TABLE admin_role_permissions (
  role_id uuid NOT NULL REFERENCES admin_roles(id), permission_code text NOT NULL REFERENCES admin_permissions(code),
  PRIMARY KEY (role_id,permission_code)
);
CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email_lookup_hash text NOT NULL UNIQUE,
  email_ciphertext bytea NOT NULL, password_hash text NOT NULL,
  totp_secret_ciphertext bytea, status account_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE admin_user_roles (
  admin_user_id uuid NOT NULL REFERENCES admin_users(id), role_id uuid NOT NULL REFERENCES admin_roles(id),
  PRIMARY KEY (admin_user_id,role_id)
);
CREATE TABLE admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), admin_user_id uuid NOT NULL REFERENCES admin_users(id),
  family_id uuid NOT NULL, refresh_token_hash text NOT NULL UNIQUE,
  rotated_from uuid UNIQUE REFERENCES admin_sessions(id),
  device_id_hash text NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), CHECK (expires_at > created_at)
);
CREATE TABLE verification_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  type text NOT NULL CHECK (type IN ('identity','pan','selfie','bank','risk')),
  provider text, provider_ref text, status verification_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES admin_users(id), decision_code text,
  submitted_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz, expires_at timestamptz,
  UNIQUE(provider,provider_ref)
);
CREATE INDEX verification_review_queue ON verification_records(status,submitted_at);
CREATE TABLE verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), verification_record_id uuid NOT NULL REFERENCES verification_records(id),
  document_type text NOT NULL, encrypted_object_key text NOT NULL,
  checksum_sha256 text NOT NULL, content_type text NOT NULL, size_bytes bigint NOT NULL CHECK(size_bytes > 0),
  retention_until timestamptz NOT NULL, deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  holder_name_ciphertext bytea NOT NULL, account_number_ciphertext bytea NOT NULL,
  account_fingerprint text NOT NULL, last_four char(4) NOT NULL CHECK(last_four ~ '^[0-9]{4}$'),
  ifsc char(11) NOT NULL CHECK(ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'), bank_name text NOT NULL,
  verification_status verification_status NOT NULL DEFAULT 'required',
  is_default boolean NOT NULL DEFAULT false, disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,user_id), UNIQUE(user_id,account_fingerprint),
  CHECK (NOT is_default OR (verification_status='verified' AND disabled_at IS NULL))
);
CREATE UNIQUE INDEX bank_one_default ON bank_accounts(user_id) WHERE is_default AND disabled_at IS NULL;

CREATE TABLE assets (symbol text PRIMARY KEY, display_name text NOT NULL, ledger_decimals integer NOT NULL CHECK(ledger_decimals BETWEEN 0 AND 18));
CREATE TABLE networks (
  code text PRIMARY KEY, display_name text NOT NULL, chain_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT false, required_confirmations integer NOT NULL CHECK(required_confirmations > 0)
);
CREATE TABLE token_contracts (
  network_code text NOT NULL REFERENCES networks(code), asset_symbol text NOT NULL REFERENCES assets(symbol),
  contract_address text NOT NULL, decimals integer NOT NULL CHECK(decimals BETWEEN 0 AND 18),
  enabled boolean NOT NULL DEFAULT false, PRIMARY KEY(network_code,asset_symbol),
  UNIQUE(network_code,asset_symbol,contract_address)
);
CREATE TABLE wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  asset_symbol text NOT NULL REFERENCES assets(symbol), status account_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,asset_symbol), UNIQUE(id,user_id,asset_symbol)
);
CREATE TABLE wallet_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), wallet_id uuid NOT NULL,
  user_id uuid NOT NULL, asset_symbol text NOT NULL, network_code text NOT NULL,
  address text NOT NULL, custody_provider text NOT NULL, custody_ref text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(), retired_at timestamptz,
  FOREIGN KEY(wallet_id,user_id,asset_symbol) REFERENCES wallets(id,user_id,asset_symbol),
  FOREIGN KEY(network_code,asset_symbol) REFERENCES token_contracts(network_code,asset_symbol),
  UNIQUE(network_code,address), UNIQUE(id,wallet_id,user_id,asset_symbol,network_code)
);
CREATE TABLE blockchain_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), network_code text NOT NULL,
  tx_hash text NOT NULL, event_index integer NOT NULL CHECK(event_index >= 0),
  asset_symbol text NOT NULL, contract_address text NOT NULL,
  sender text NOT NULL, receiver text NOT NULL,
  raw_amount numeric(78,0) NOT NULL CHECK(raw_amount > 0),
  amount numeric(38,18) NOT NULL CHECK(amount > 0),
  block_number bigint NOT NULL CHECK(block_number >= 0), block_hash text NOT NULL,
  confirmations integer NOT NULL DEFAULT 0 CHECK(confirmations >= 0),
  status chain_status NOT NULL DEFAULT 'detected', block_timestamp timestamptz NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(), confirmed_at timestamptz,
  FOREIGN KEY(network_code,asset_symbol,contract_address) REFERENCES token_contracts(network_code,asset_symbol,contract_address),
  UNIQUE(network_code,tx_hash,event_index), UNIQUE(id,asset_symbol,network_code,receiver,amount)
);
CREATE INDEX chain_confirmation_queue ON blockchain_transactions(status,network_code,block_number);
CREATE TABLE deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, wallet_id uuid NOT NULL,
  wallet_address_id uuid NOT NULL, network_code text NOT NULL, asset_symbol text NOT NULL,
  transaction_id uuid NOT NULL UNIQUE, receiver text NOT NULL,
  amount numeric(38,18) NOT NULL CHECK(amount > 0),
  status text NOT NULL DEFAULT 'confirming' CHECK(status IN ('detected','confirming','credited','review','reversed')),
  credited_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(wallet_address_id,wallet_id,user_id,asset_symbol,network_code)
    REFERENCES wallet_addresses(id,wallet_id,user_id,asset_symbol,network_code),
  FOREIGN KEY(transaction_id,asset_symbol,network_code,receiver,amount)
    REFERENCES blockchain_transactions(id,asset_symbol,network_code,receiver,amount),
  UNIQUE(id,user_id), CHECK(status <> 'credited' OR credited_at IS NOT NULL)
);
CREATE INDEX deposits_user_date ON deposits(user_id,created_at DESC);

CREATE TABLE exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), base_asset text NOT NULL REFERENCES assets(symbol),
  quote_asset text NOT NULL REFERENCES assets(symbol), mode rate_mode NOT NULL,
  market_rate numeric(20,8), effective_rate numeric(20,8) NOT NULL CHECK(effective_rate > 0),
  margin_bps integer NOT NULL DEFAULT 0 CHECK(margin_bps BETWEEN -10000 AND 10000),
  source text NOT NULL, observed_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
  created_by uuid REFERENCES admin_users(id), CHECK(expires_at > observed_at),
  CHECK(mode='manual' OR (market_rate IS NOT NULL AND market_rate > 0))
);
CREATE TABLE fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), version integer NOT NULL UNIQUE CHECK(version > 0),
  flat_inr_minor bigint NOT NULL DEFAULT 0 CHECK(flat_inr_minor >= 0),
  basis_points integer NOT NULL DEFAULT 0 CHECK(basis_points BETWEEN 0 AND 10000),
  effective_from timestamptz NOT NULL, retired_at timestamptz, created_by uuid REFERENCES admin_users(id)
);
CREATE TABLE rate_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), version integer NOT NULL UNIQUE CHECK(version > 0),
  mode rate_mode NOT NULL, manual_rate numeric(20,8), margin_bps integer NOT NULL DEFAULT 0,
  minimum_sell numeric(38,18) NOT NULL CHECK(minimum_sell > 0),
  maximum_sell numeric(38,18) NOT NULL, daily_limit numeric(38,18) NOT NULL, monthly_limit numeric(38,18) NOT NULL,
  quote_expiry_seconds integer NOT NULL CHECK(quote_expiry_seconds BETWEEN 15 AND 600),
  maximum_rate_age_seconds integer NOT NULL CHECK(maximum_rate_age_seconds > 0),
  fee_id uuid NOT NULL REFERENCES fees(id), effective_from timestamptz NOT NULL, retired_at timestamptz,
  created_by uuid REFERENCES admin_users(id),
  CHECK(maximum_sell >= minimum_sell AND daily_limit >= maximum_sell AND monthly_limit >= daily_limit),
  CHECK(mode <> 'manual' OR (manual_rate IS NOT NULL AND manual_rate > 0))
);
CREATE TABLE quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  bank_account_id uuid NOT NULL, funding_source funding_source NOT NULL,
  amount_usdt numeric(38,18) NOT NULL CHECK(amount_usdt > 0),
  rate_inr numeric(20,8) NOT NULL CHECK(rate_inr > 0),
  gross_inr_minor bigint NOT NULL CHECK(gross_inr_minor > 0),
  fee_inr_minor bigint NOT NULL CHECK(fee_inr_minor >= 0),
  net_inr_minor bigint NOT NULL CHECK(net_inr_minor > 0),
  exchange_rate_id uuid NOT NULL REFERENCES exchange_rates(id), fee_id uuid NOT NULL REFERENCES fees(id),
  rate_policy_id uuid NOT NULL REFERENCES rate_policies(id),
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  FOREIGN KEY(bank_account_id,user_id) REFERENCES bank_accounts(id,user_id),
  UNIQUE(id,user_id,bank_account_id,funding_source),
  CHECK(gross_inr_minor=fee_inr_minor+net_inr_minor),
  CHECK(gross_inr_minor=floor(amount_usdt*rate_inr*100)),
  CHECK(expires_at > created_at)
);
CREATE TABLE sell_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_number text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES users(id), quote_id uuid NOT NULL UNIQUE,
  bank_account_id uuid NOT NULL, funding_source funding_source NOT NULL,
  status sell_status NOT NULL DEFAULT 'awaiting_funds', version integer NOT NULL DEFAULT 0 CHECK(version >= 0),
  accepted_at timestamptz NOT NULL DEFAULT now(), funding_deadline timestamptz NOT NULL,
  funded_at timestamptz, completed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(quote_id,user_id,bank_account_id,funding_source) REFERENCES quotes(id,user_id,bank_account_id,funding_source),
  UNIQUE(id,user_id), UNIQUE(id,user_id,bank_account_id), CHECK(funding_deadline > accepted_at),
  CHECK(status <> 'completed' OR completed_at IS NOT NULL)
);
CREATE INDEX sell_user_date ON sell_orders(user_id,accepted_at DESC);
CREATE INDEX sell_pending ON sell_orders(status,accepted_at) WHERE status NOT IN ('completed','expired','cancelled');
CREATE TABLE order_deposit_allocations (
  order_id uuid NOT NULL, deposit_id uuid NOT NULL UNIQUE, user_id uuid NOT NULL,
  allocated_amount numeric(38,18) NOT NULL CHECK(allocated_amount > 0),
  PRIMARY KEY(order_id,deposit_id),
  FOREIGN KEY(order_id,user_id) REFERENCES sell_orders(id,user_id),
  FOREIGN KEY(deposit_id,user_id) REFERENCES deposits(id,user_id)
);

CREATE TABLE ledger_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE,
  user_id uuid REFERENCES users(id), asset_symbol text NOT NULL REFERENCES assets(symbol),
  kind text NOT NULL CHECK(kind IN ('asset','liability','income','expense','equity')),
  bucket text NOT NULL CHECK(bucket IN ('available','reserved','custody','payout_clearing','fees','adjustment')),
  normal_side entry_side NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,asset_symbol), UNIQUE(user_id,asset_symbol,bucket),
  CHECK((kind IN ('asset','expense') AND normal_side='debit') OR (kind IN ('liability','income','equity') AND normal_side='credit'))
);
CREATE TABLE ledger_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_key text NOT NULL UNIQUE,
  event_type text NOT NULL CHECK(event_type IN ('deposit','reserve','sell','fee','payout','adjustment','reversal')),
  source_id uuid NOT NULL, reversal_of uuid UNIQUE REFERENCES ledger_journals(id),
  description text NOT NULL, created_by_admin uuid REFERENCES admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now(), creation_xid bigint NOT NULL DEFAULT txid_current(),
  CHECK((event_type='reversal')=(reversal_of IS NOT NULL)),
  CHECK(event_type <> 'adjustment' OR created_by_admin IS NOT NULL)
);
CREATE TABLE ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), journal_id uuid NOT NULL REFERENCES ledger_journals(id),
  account_id uuid NOT NULL, asset_symbol text NOT NULL REFERENCES assets(symbol),
  side entry_side NOT NULL, amount numeric(38,18) NOT NULL CHECK(amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(account_id,asset_symbol) REFERENCES ledger_accounts(id,asset_symbol)
);
CREATE INDEX ledger_entries_account ON ledger_entries(account_id,created_at,id);
CREATE INDEX ledger_entries_journal ON ledger_entries(journal_id);
CREATE VIEW ledger_balances AS
 SELECT a.id account_id,a.user_id,a.asset_symbol,a.bucket,
 COALESCE(SUM(CASE WHEN e.side=a.normal_side THEN e.amount ELSE -e.amount END),0)::numeric(38,18) balance
 FROM ledger_accounts a LEFT JOIN ledger_entries e ON e.account_id=a.id GROUP BY a.id;

CREATE TABLE payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL UNIQUE, user_id uuid NOT NULL,
  bank_account_id uuid NOT NULL, beneficiary_snapshot_ciphertext bytea NOT NULL,
  rail text NOT NULL CHECK(rail IN ('IMPS','NEFT','RTGS')), amount_inr_minor bigint NOT NULL CHECK(amount_inr_minor > 0),
  status payout_status NOT NULL DEFAULT 'pending', idempotency_key text NOT NULL UNIQUE,
  provider text NOT NULL, provider_ref text, utr text, failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
  FOREIGN KEY(order_id,user_id,bank_account_id) REFERENCES sell_orders(id,user_id,bank_account_id),
  UNIQUE(provider,provider_ref), CHECK(status <> 'success' OR completed_at IS NOT NULL)
);
CREATE INDEX payouts_queue ON payouts(status,created_at);
CREATE TABLE payout_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payout_id uuid NOT NULL REFERENCES payouts(id),
  attempt_number integer NOT NULL CHECK(attempt_number > 0), provider_request_key text NOT NULL UNIQUE,
  status payout_status NOT NULL, provider_ref text, response_code text,
  started_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz, UNIQUE(payout_id,attempt_number)
);
CREATE TABLE provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider text NOT NULL, event_id text NOT NULL,
  payload_digest text NOT NULL, signature_verified_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz, UNIQUE(provider,event_id)
);
CREATE TABLE referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), referrer_id uuid NOT NULL REFERENCES users(id),
  referred_user_id uuid UNIQUE REFERENCES users(id), code text NOT NULL,
  reward_inr_minor bigint NOT NULL DEFAULT 0 CHECK(reward_inr_minor >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','qualified','rewarded','rejected','reversed')),
  reward_journal_id uuid UNIQUE REFERENCES ledger_journals(id),
  created_at timestamptz NOT NULL DEFAULT now(), CHECK(referrer_id <> referred_user_id)
);
CREATE TABLE referral_codes (user_id uuid PRIMARY KEY REFERENCES users(id), code text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE referrals ADD FOREIGN KEY(code) REFERENCES referral_codes(code);
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  type text NOT NULL, title text NOT NULL, body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}', read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_inbox ON notifications(user_id,created_at DESC);
CREATE TABLE support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  subject text NOT NULL, body_ciphertext bytea NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved','closed')),
  assigned_to uuid REFERENCES admin_users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  admin_user_id uuid NOT NULL REFERENCES admin_users(id), body_ciphertext bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  order_id uuid REFERENCES sell_orders(id), code text NOT NULL,
  severity text NOT NULL CHECK(severity IN ('low','medium','high','critical')),
  state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','reviewing','resolved')),
  sanitized_context jsonb NOT NULL DEFAULT '{}', reviewed_by uuid REFERENCES admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz
);
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_type text NOT NULL CHECK(actor_type IN ('user','admin','service')),
  actor_id text NOT NULL, action text NOT NULL, entity_type text NOT NULL, entity_id text NOT NULL,
  request_id uuid NOT NULL, sanitized_changes jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_entity_date ON audit_logs(entity_type,entity_id,created_at DESC);
CREATE TABLE system_settings (
  key text PRIMARY KEY, value jsonb NOT NULL, version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  updated_by uuid REFERENCES admin_users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id text NOT NULL, scope text NOT NULL,
  key text NOT NULL, request_hash text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','completed','failed')),
  response_status integer, response_ciphertext bytea,
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  UNIQUE(actor_id,scope,key), CHECK(expires_at > created_at)
);
CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), aggregate_type text NOT NULL, aggregate_id uuid NOT NULL,
  event_type text NOT NULL, dedupe_key text NOT NULL UNIQUE, payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts >= 0), published_at timestamptz, last_error_code text
);
CREATE INDEX outbox_unpublished ON outbox_events(available_at) WHERE published_at IS NULL;

-- Append-only financial history. Reversals add a new, linked journal.
CREATE FUNCTION deny_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '% is immutable: create a new record or reversal',TG_TABLE_NAME; END $$;
CREATE TRIGGER quotes_immutable BEFORE UPDATE OR DELETE ON quotes FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE TRIGGER exchange_rates_immutable BEFORE UPDATE OR DELETE ON exchange_rates FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE TRIGGER ledger_entries_immutable BEFORE UPDATE OR DELETE ON ledger_entries FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE TRIGGER ledger_journals_immutable BEFORE UPDATE OR DELETE ON ledger_journals FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE TRIGGER ledger_entries_no_truncate BEFORE TRUNCATE ON ledger_entries FOR EACH STATEMENT EXECUTE FUNCTION deny_mutation();
CREATE TRIGGER ledger_journals_no_truncate BEFORE TRUNCATE ON ledger_journals FOR EACH STATEMENT EXECUTE FUNCTION deny_mutation();
CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON audit_logs FOR EACH STATEMENT EXECUTE FUNCTION deny_mutation();

CREATE FUNCTION protect_bank_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.user_id,NEW.holder_name_ciphertext,NEW.account_number_ciphertext,NEW.account_fingerprint,NEW.ifsc,NEW.last_four,NEW.bank_name)
 IS DISTINCT FROM ROW(OLD.user_id,OLD.holder_name_ciphertext,OLD.account_number_ciphertext,OLD.account_fingerprint,OLD.ifsc,OLD.last_four,OLD.bank_name)
 THEN RAISE EXCEPTION 'Bank identity is immutable; disable and add a new account'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER bank_identity_immutable BEFORE UPDATE ON bank_accounts FOR EACH ROW EXECUTE FUNCTION protect_bank_identity();

CREATE FUNCTION validate_order_acceptance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE q quotes;
BEGIN
 SELECT * INTO STRICT q FROM quotes WHERE id=NEW.quote_id FOR UPDATE;
 IF q.expires_at <= statement_timestamp() THEN RAISE EXCEPTION 'Quote expired'; END IF;
 -- The accepted timestamp is server-owned; never accepted from a caller.
 NEW.accepted_at := statement_timestamp();
 RETURN NEW;
END $$;
CREATE TRIGGER sell_acceptance BEFORE INSERT ON sell_orders FOR EACH ROW EXECUTE FUNCTION validate_order_acceptance();
CREATE FUNCTION protect_order_terms() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.id,NEW.quote_id,NEW.user_id,NEW.bank_account_id,NEW.funding_source,NEW.accepted_at,NEW.funding_deadline)
 IS DISTINCT FROM ROW(OLD.id,OLD.quote_id,OLD.user_id,OLD.bank_account_id,OLD.funding_source,OLD.accepted_at,OLD.funding_deadline)
 THEN RAISE EXCEPTION 'Accepted order terms are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sell_terms_immutable BEFORE UPDATE ON sell_orders FOR EACH ROW EXECUTE FUNCTION protect_order_terms();

CREATE FUNCTION validate_ledger_entry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE journal_xid bigint; precision_digits integer;
BEGIN
 SELECT creation_xid INTO STRICT journal_xid FROM ledger_journals WHERE id=NEW.journal_id;
 IF journal_xid <> txid_current() THEN RAISE EXCEPTION 'Cannot append to a committed journal'; END IF;
 SELECT ledger_decimals INTO STRICT precision_digits FROM assets WHERE symbol=NEW.asset_symbol;
 IF NEW.amount <> trunc(NEW.amount,precision_digits) THEN RAISE EXCEPTION 'Invalid asset precision'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ledger_entry_precision BEFORE INSERT ON ledger_entries FOR EACH ROW EXECUTE FUNCTION validate_ledger_entry();
CREATE FUNCTION validate_journal_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE jid uuid; line_count integer;
BEGIN
 IF TG_TABLE_NAME='ledger_journals' THEN jid := NEW.id; ELSE jid := NEW.journal_id; END IF;
 SELECT count(*) INTO line_count FROM ledger_entries WHERE journal_id=jid;
 IF line_count < 2 THEN RAISE EXCEPTION 'Journal requires at least two entries'; END IF;
 IF EXISTS (SELECT asset_symbol FROM ledger_entries WHERE journal_id=jid GROUP BY asset_symbol
   HAVING SUM(CASE WHEN side='debit' THEN amount ELSE -amount END) <> 0)
 THEN RAISE EXCEPTION 'Journal must balance separately for each asset'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER journal_balanced AFTER INSERT ON ledger_journals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_journal_balance();
CREATE CONSTRAINT TRIGGER entries_balanced AFTER INSERT ON ledger_entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_journal_balance();
CREATE FUNCTION protect_ledger_account() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.user_id,NEW.asset_symbol,NEW.kind,NEW.bucket,NEW.normal_side) IS DISTINCT FROM ROW(OLD.user_id,OLD.asset_symbol,OLD.kind,OLD.bucket,OLD.normal_side)
 THEN RAISE EXCEPTION 'Ledger account identity is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ledger_account_identity BEFORE UPDATE ON ledger_accounts FOR EACH ROW EXECUTE FUNCTION protect_ledger_account();
CREATE FUNCTION validate_deposit_address() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM wallet_addresses WHERE id=NEW.wallet_address_id AND address=NEW.receiver)
 THEN RAISE EXCEPTION 'Deposit receiver does not match assigned address'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER deposit_address_matches BEFORE INSERT OR UPDATE ON deposits FOR EACH ROW EXECUTE FUNCTION validate_deposit_address();
CREATE FUNCTION validate_payout_amount() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected bigint;
BEGIN
 SELECT q.net_inr_minor INTO STRICT expected FROM sell_orders s JOIN quotes q ON q.id=s.quote_id WHERE s.id=NEW.order_id;
 IF NEW.amount_inr_minor <> expected THEN RAISE EXCEPTION 'Payout amount must equal accepted net quote'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER payout_amount_matches BEFORE INSERT OR UPDATE ON payouts FOR EACH ROW EXECUTE FUNCTION validate_payout_amount();
ALTER TABLE referral_codes ADD UNIQUE(user_id,code);
ALTER TABLE referrals ADD FOREIGN KEY(referrer_id,code) REFERENCES referral_codes(user_id,code);
CREATE FUNCTION stamp_journal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.creation_xid := txid_current(); NEW.created_at := statement_timestamp(); RETURN NEW; END $$;
CREATE TRIGGER journal_server_fields BEFORE INSERT ON ledger_journals FOR EACH ROW EXECUTE FUNCTION stamp_journal();
CREATE FUNCTION protect_payout_terms() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.order_id,NEW.user_id,NEW.bank_account_id,NEW.beneficiary_snapshot_ciphertext,NEW.rail,NEW.amount_inr_minor,NEW.idempotency_key,NEW.provider)
 IS DISTINCT FROM ROW(OLD.order_id,OLD.user_id,OLD.bank_account_id,OLD.beneficiary_snapshot_ciphertext,OLD.rail,OLD.amount_inr_minor,OLD.idempotency_key,OLD.provider)
 THEN RAISE EXCEPTION 'Payout terms are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER payout_terms_immutable BEFORE UPDATE ON payouts FOR EACH ROW EXECUTE FUNCTION protect_payout_terms();
CREATE FUNCTION protect_chain_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.network_code,NEW.tx_hash,NEW.event_index,NEW.asset_symbol,NEW.contract_address,NEW.sender,NEW.receiver,NEW.raw_amount,NEW.amount)
 IS DISTINCT FROM ROW(OLD.network_code,OLD.tx_hash,OLD.event_index,OLD.asset_symbol,OLD.contract_address,OLD.sender,OLD.receiver,OLD.raw_amount,OLD.amount)
 THEN RAISE EXCEPTION 'Blockchain transfer identity is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER chain_identity_immutable BEFORE UPDATE ON blockchain_transactions FOR EACH ROW EXECUTE FUNCTION protect_chain_identity();

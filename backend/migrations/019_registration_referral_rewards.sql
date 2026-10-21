-- Separate, non-spendable USDT referral accruals. Existing INR rewards stay intact.
CREATE TABLE referral_reward_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 referral_id uuid NOT NULL UNIQUE REFERENCES referrals(id),
 user_id uuid NOT NULL REFERENCES users(id),
 amount_usdt numeric(38,6) NOT NULL CHECK(amount_usdt>0),
 policy_snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER referral_reward_entries_immutable BEFORE UPDATE OR DELETE ON referral_reward_entries
 FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE TABLE referral_reward_releases (
 reward_id uuid PRIMARY KEY REFERENCES referral_reward_entries(id),
 admin_id uuid NOT NULL REFERENCES admin_users(id),
 journal_id uuid NOT NULL UNIQUE REFERENCES ledger_journals(id),
 reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 500),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER referral_reward_releases_immutable BEFORE UPDATE OR DELETE ON referral_reward_releases
 FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE INDEX referral_rewards_user_date ON referral_reward_entries(user_id,created_at DESC);
CREATE INDEX referrals_referrer_date ON referrals(referrer_id,created_at DESC);
CREATE FUNCTION protect_referral_attribution() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.referrer_id,NEW.referred_user_id,NEW.code,NEW.rule_snapshot) IS DISTINCT FROM
 ROW(OLD.referrer_id,OLD.referred_user_id,OLD.code,OLD.rule_snapshot) THEN
 RAISE EXCEPTION 'Referral attribution and policy snapshot are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER referral_attribution_immutable BEFORE UPDATE ON referrals
 FOR EACH ROW EXECUTE FUNCTION protect_referral_attribution();
INSERT INTO referral_codes(user_id,code)
 SELECT id,'DT'||upper(replace(id::text,'-','')) FROM users ON CONFLICT(user_id) DO NOTHING;
CREATE FUNCTION create_user_referral_code() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO referral_codes(user_id,code) VALUES(NEW.id,'DT'||upper(replace(NEW.id::text,'-','')));
 RETURN NEW;
END $$;
CREATE TRIGGER user_referral_code AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION create_user_referral_code();
INSERT INTO system_settings(key,value) VALUES('registration_referral_policy',
 '{"enabled":false,"rewardUsdt":"0.1","event":"REGISTRATION_OTP","creditMode":"MANUAL_RELEASE"}');
INSERT INTO admin_permissions(code,description) VALUES('referrals.release','Manually release a reviewed referral reward; never an external payout') ON CONFLICT DO NOTHING;
INSERT INTO admin_role_permissions(role_id,permission_code)
 SELECT id,'referrals.release' FROM admin_roles WHERE name='OWNER_ADMIN' ON CONFLICT DO NOTHING;

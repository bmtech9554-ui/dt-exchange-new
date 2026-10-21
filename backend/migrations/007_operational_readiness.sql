-- Additive operational controls. Existing financial snapshots and transitions remain intact.
INSERT INTO system_settings(key,value) VALUES('operational_controls',
'{"mode":"NORMAL","registrations":true,"deposits":true,"sell":true,"payouts":true,"referrals":true,"notifications":true,"support":true}') ON CONFLICT DO NOTHING;
ALTER TABLE system_settings ADD CONSTRAINT operational_controls_shape CHECK(key<>'operational_controls' OR (
 value->>'mode' IN ('NORMAL','READ_ONLY','MAINTENANCE') AND value ?& ARRAY['mode','registrations','deposits','sell','payouts','referrals','notifications','support']
 AND jsonb_typeof(value->'registrations')='boolean' AND jsonb_typeof(value->'deposits')='boolean'
 AND jsonb_typeof(value->'sell')='boolean' AND jsonb_typeof(value->'payouts')='boolean'
 AND jsonb_typeof(value->'referrals')='boolean' AND jsonb_typeof(value->'notifications')='boolean' AND jsonb_typeof(value->'support')='boolean'));
CREATE FUNCTION operational_gate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE config jsonb; feature text:=TG_ARGV[0];
BEGIN
 -- Updates only gate the transition that claims a NEW provider side effect.
 IF TG_TABLE_NAME='payout_attempts' THEN IF NEW.lifecycle<>'SUBMITTED' OR OLD.lifecycle='SUBMITTED' THEN RETURN NEW; END IF; END IF;
 IF TG_TABLE_NAME='notification_deliveries' THEN IF NEW.attempt_count<=OLD.attempt_count THEN RETURN NEW; END IF; END IF;
 IF TG_TABLE_NAME='ledger_journals' THEN IF NEW.event_type<>'referral' THEN RETURN NEW; END IF; END IF;
 SELECT value INTO config FROM system_settings WHERE key='operational_controls' FOR SHARE;
 IF config IS NULL OR config->>'mode'<>'NORMAL' OR (config->>feature)::boolean IS NOT TRUE THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='DT_OPERATION_PAUSED';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER operations_registration BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION operational_gate('registrations');
CREATE TRIGGER operations_quotes BEFORE INSERT ON quotes FOR EACH ROW EXECUTE FUNCTION operational_gate('sell');
CREATE TRIGGER operations_orders BEFORE INSERT ON sell_orders FOR EACH ROW EXECUTE FUNCTION operational_gate('sell');
CREATE TRIGGER operations_addresses BEFORE INSERT ON wallet_addresses FOR EACH ROW EXECUTE FUNCTION operational_gate('deposits');
CREATE TRIGGER operations_payout_creation BEFORE INSERT ON payouts FOR EACH ROW EXECUTE FUNCTION operational_gate('payouts');
CREATE TRIGGER operations_payout_submission BEFORE UPDATE ON payout_attempts FOR EACH ROW EXECUTE FUNCTION operational_gate('payouts');
CREATE TRIGGER operations_referral_claim BEFORE INSERT ON referrals FOR EACH ROW EXECUTE FUNCTION operational_gate('referrals');
CREATE TRIGGER operations_referral_reward BEFORE INSERT ON ledger_journals FOR EACH ROW EXECUTE FUNCTION operational_gate('referrals');
CREATE TRIGGER operations_notification_send BEFORE UPDATE ON notification_deliveries FOR EACH ROW EXECUTE FUNCTION operational_gate('notifications');
CREATE TRIGGER operations_support BEFORE INSERT ON support_tickets FOR EACH ROW EXECUTE FUNCTION operational_gate('support');
-- Existing incoming deposits, confirmations, webhooks, reversals and reconciliation must continue.
CREATE VIEW ledger_integrity_issues AS
 SELECT j.id journal_id,e.asset_symbol,
 COALESCE(sum(CASE WHEN e.side='debit' THEN e.amount ELSE -e.amount END),0)::text imbalance,
 count(e.id)::text entry_count
 FROM ledger_journals j LEFT JOIN ledger_entries e ON e.journal_id=j.id
 GROUP BY j.id,e.asset_symbol
 HAVING count(e.id)<2 OR sum(CASE WHEN e.side='debit' THEN e.amount ELSE -e.amount END)<>0;
INSERT INTO admin_permissions(code,description) VALUES
 ('dashboard.read','View aggregate operations'),('users.read','View masked account records'),
 ('users.manage','Freeze, suspend or activate accounts with reason'),('verification.read','Read verification review evidence'),
 ('verification.review','Record review notes; no unverified provider approval'),('banks.read','View masked bank records'),
 ('wallets.read','Read ledger-derived wallet state'),('audit.read','View audit event summaries'),
 ('settings.read','Read operational configuration'),('settings.write','Change operational switches with reason'),
 ('reconciliation.read','Read reconciliation issues'),('reconciliation.resolve','Resolve reviewed issues with reason'),
 ('providers.read','Read safe provider readiness'),
 ('system.monitor','Read worker health and queues'),('support.write','Manage support'),('support.faq','Manage help content'),
 ('referrals.read','Read referrals'),('referrals.review','Review referrals'),('referrals.rules','Manage referral rules'),
 ('notifications.manage','Manage notification delivery'),('notifications.publish','Publish bounded announcements'),
 ('payouts.read','Read payouts'),('payouts.retry','Retry eligible payouts'),('payouts.refresh','Refresh provider evidence'),('payouts.review','Review payout issues') ON CONFLICT DO NOTHING;
INSERT INTO admin_roles(name,description) VALUES
 ('notification-manager','Notifications only'),('referral-manager','Referrals only'),
 ('financial-monitor','Read-only financial monitoring'),('verification-reviewer','Verification review; no payout permission'),
 ('system-operator','Operational controls and health'),('reconciliation-operator','Reconciliation review'),
 ('account-operator','Account review and status controls'),('super-admin','Explicitly assigned break-glass role; never granted automatically') ON CONFLICT DO NOTHING;
INSERT INTO admin_role_permissions(role_id,permission_code)
 SELECT r.id,p.code FROM admin_roles r CROSS JOIN admin_permissions p WHERE
 (r.name='notification-manager' AND p.code IN ('notifications.manage','notifications.publish')) OR
 (r.name='referral-manager' AND p.code IN ('referrals.read','referrals.review','referrals.rules')) OR
 (r.name='financial-monitor' AND p.code IN ('dashboard.read','orders.read','deposits.read','payouts.read','wallets.read','reconciliation.read')) OR
 (r.name='verification-reviewer' AND p.code IN ('users.read','verification.read','verification.review','banks.read')) OR
 (r.name='system-operator' AND p.code IN ('settings.read','settings.write','system.monitor','providers.read','audit.read')) OR
 (r.name='reconciliation-operator' AND p.code IN ('reconciliation.read','reconciliation.resolve','payouts.read','wallets.read')) OR
 (r.name='account-operator' AND p.code IN ('users.read','users.manage','banks.read')) OR r.name='super-admin'
 ON CONFLICT DO NOTHING;
CREATE INDEX audit_created_cursor ON audit_logs(created_at DESC,id);
CREATE INDEX payouts_lifecycle_updated ON payouts(lifecycle,updated_at);

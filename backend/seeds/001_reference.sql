-- Reference data only. No demo users, credentials, live rate, wallets or money.
INSERT INTO assets(symbol,display_name,ledger_decimals) VALUES('USDT','Tether USD',18),('INR','Indian Rupee',2) ON CONFLICT DO NOTHING;
INSERT INTO networks(code,display_name,chain_id,enabled,required_confirmations)
 VALUES('TRON','TRON TRC20','tron-mainnet',false,20),('ETHEREUM','Ethereum ERC20','1',false,64),('BSC','BNB Smart Chain BEP20','56',false,20) ON CONFLICT DO NOTHING;
-- Token contract addresses require explicit verified configuration before deposits.
INSERT INTO admin_roles(name,description) VALUES
 ('reviewer','Review verification and risk; no payouts'),('operations','Review deposits and orders; no manual balance edits'),
 ('treasury','Review payouts and reconciliation'),('support','Read permitted user context and handle tickets'),
 ('administrator','Manage approved roles and configuration') ON CONFLICT DO NOTHING;
INSERT INTO admin_permissions(code,description) VALUES
 ('users.read','View permitted user fields'),('users.status.write','Freeze, suspend, activate with audit'),
 ('verification.review','Review submitted verification'),('orders.read','Read orders'),
 ('payouts.review','Review payouts'),('settings.write','Change approved configuration'),
 ('support.write','Handle support tickets'),('audit.read','Read redacted audit logs') ON CONFLICT DO NOTHING;
-- Role grants deliberately not assigned until the authorization matrix is implemented.
INSERT INTO system_settings(key,value) VALUES
 ('trading_enabled','false'),('payouts_enabled','false'),('deposits_enabled','false'),
 ('brand_version','1'),('implementation_phase','1') ON CONFLICT DO NOTHING;

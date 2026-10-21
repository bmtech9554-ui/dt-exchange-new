-- Canonical, non-financial reference rows are required by rate snapshots.
-- Migrations-only production deployments must not depend on development seeds.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM assets WHERE (symbol='USDT' AND ledger_decimals<>18) OR (symbol='INR' AND ledger_decimals<>2)) THEN
  RAISE EXCEPTION 'Canonical asset precision differs; explicit review required';
 END IF;
END $$;
WITH inserted AS (
 INSERT INTO assets(symbol,display_name,ledger_decimals)
 VALUES('USDT','Tether USD',18),('INR','Indian Rupee',2)
 ON CONFLICT(symbol) DO NOTHING RETURNING symbol,ledger_decimals
)
INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes)
SELECT 'service','migration-012','reference.asset.created','asset',symbol,gen_random_uuid(),jsonb_build_object('symbol',symbol,'ledgerDecimals',ledger_decimals) FROM inserted;

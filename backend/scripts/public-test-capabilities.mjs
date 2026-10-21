import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {assertPublicTestIsolation}=require('../dist/public-test/isolation.js');
export async function ensureSimulationCapabilities(db){
 assertPublicTestIsolation();
 const marker=(await db.query("SELECT value FROM system_settings WHERE key='public_software_test'")).rows[0]?.value;
 if(marker?.mode!=='PUBLIC_SOFTWARE_TEST'||marker.realMoney!==false)throw Error('ISOLATED_DEMO_DATABASE_REQUIRED');
 await db.query("INSERT INTO admin_roles(name,description) VALUES('public-test-operations','Isolated simulation review and demo-user access only') ON CONFLICT DO NOTHING");
 await db.query("INSERT INTO admin_role_permissions(role_id,permission_code) SELECT id,unnest(ARRAY['DEPOSIT_REVIEW','DEPOSIT_APPROVE','PAYOUT_VIEW','PAYOUT_PROCESS','PAYOUT_CONFIRM','orders.read','payouts.review','users.read','users.edit']) FROM admin_roles WHERE name='public-test-operations' ON CONFLICT DO NOTHING");
}

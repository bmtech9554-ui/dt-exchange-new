// Isolated development network only. Production contract/custody provisioning is an operator task.
export async function seedPhase4(db){
 if(process.env.NODE_ENV==='production')throw new Error('Development chain seed is forbidden in production');
 await db.query("INSERT INTO networks(code,display_name,chain_id,enabled,required_confirmations) VALUES('tron-mock','TRON development sandbox','tron-mock',true,$1) ON CONFLICT(code) DO UPDATE SET required_confirmations=excluded.required_confirmations",[Number(process.env.TRON_REQUIRED_CONFIRMATIONS??20)]);
 await db.query("INSERT INTO token_contracts(network_code,asset_symbol,contract_address,decimals,enabled) VALUES('tron-mock','USDT','DT-MOCK-USDT-CONTRACT',6,true) ON CONFLICT DO NOTHING");
 await db.query("INSERT INTO admin_role_permissions(role_id,permission_code) SELECT id,p FROM admin_roles CROSS JOIN unnest(ARRAY['orders.read','deposits.read','reviews.read','reviews.acknowledge']) p WHERE name='operations' ON CONFLICT DO NOTHING");
}

if(process.argv[1]?.endsWith('seed-phase4.mjs')){
 const {default:pg}=await import('pg');const db=new pg.Client({connectionString:process.env.DATABASE_URL});
 try{await db.connect();await db.query('BEGIN');await seedPhase4(db);await db.query('COMMIT');console.log('Development chain provisioned; no payable addresses or payouts.');}catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
}

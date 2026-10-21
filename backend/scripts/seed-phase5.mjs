// Explicit role grants; no new users, passwords or transfer outcomes.
export async function seedPhase5(db){
 for(const [code,description] of [['payouts.read','Read payouts and reconciliation'],['payouts.retry','Retry definitively failed payout with reason'],['payouts.refresh','Refresh provider evidence'],['payouts.review','Review payouts with reason']]) await db.query('INSERT INTO admin_permissions(code,description) VALUES($1,$2) ON CONFLICT DO NOTHING',[code,description]);
 for(const code of ['payouts.read','payouts.retry','payouts.refresh','payouts.review']) await db.query("INSERT INTO admin_role_permissions(role_id,permission_code) SELECT id,$1 FROM admin_roles WHERE name='treasury' ON CONFLICT DO NOTHING",[code]);
}
if(process.argv[1]&&import.meta.url.endsWith(process.argv[1])){const {Client}=await import('pg');const db=new Client({connectionString:process.env.DATABASE_URL});await db.connect();try{await seedPhase5(db);}finally{await db.end();}}

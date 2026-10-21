// Opt-in only. Uses a uniquely named schema in a dedicated disposable database.
// No existing schemas or production databases are modified.
import pg from 'pg';
import {randomBytes} from 'node:crypto';
export async function realDatabase(){
 const uri=process.env.PHASE6_POSTGRES_URL;
 if(!uri||!/^dt_phase6_test(?:_[a-z0-9]+)?$/.test(new URL(uri).pathname.slice(1)))throw new Error('Use a dedicated database named dt_phase6_test with PHASE6_POSTGRES_URL');
 const schema='phase6_'+randomBytes(8).toString('hex'),admin=new pg.Client({connectionString:uri});await admin.connect();await admin.query(`CREATE SCHEMA ${schema}`);
 const pool=new pg.Pool({connectionString:uri,max:12,options:`-c search_path=${schema},public`,connectionTimeoutMillis:5000,query_timeout:15000});
 return {query:(s,p)=>pool.query(s,p),exec:s=>pool.query(s),transaction:async fn=>{const c=await pool.connect();try{await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='5s'");const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}},close:async()=>{await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}};
}

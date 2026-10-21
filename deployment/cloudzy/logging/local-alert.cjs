// Only append operational notifications/audits. No financial writes, settings,
// permissions, credentials or user records. Existing System Health title reused.
const {randomUUID}=require('node:crypto');
const allowed=new Set(['API_NOT_READY','WORKER_STALE','CLOCK_UNSYNCED','AUTOMATION_FLAG_DRIFT',
 'LEDGER_INTEGRITY_REVIEW','AUTH_FAILURE_BURST','OPEN_HIGH_RISK_REVIEW','REFERRAL_REVIEW_PENDING',
 'BACKUP_STALE','ARCHIVE_STALE','DISK_CAPACITY_LOW','DOCKER_CAPTURE_HEADROOM_LOW',
 'ARCHIVE_BUDGET_WARNING','ARCHIVE_CAPTURE_GAP','ARCHIVE_BACKLOG','ARCHIVE_INTEGRITY_FAILED',
 'LOGGING_SERVICE_FAILED','SSH_SECURITY_SERVICE_FAILED','MONITOR_EXECUTION_FAILED','RECOVERED',
 'ADMIN_AUTH_FAILURE_BURST','SSH_AUTH_FAILURE_BURST','DEPOSIT_CONFLICT_BURST']);
async function deliver(db,codes,bucket){
 if(!Array.isArray(codes)||!codes.length||codes.length>30||codes.some(c=>!allowed.has(c))||
    !Number.isSafeInteger(bucket)||bucket<0)throw Error('INVALID_MONITOR_EVENT');
 const normalized=[...new Set(codes)].sort();
 const key='technical-monitor:'+bucket+':'+normalized.join(',');
 await db.query('BEGIN');
 try{
  await db.query("SET LOCAL statement_timeout='10s'");
  const entity=randomUUID();
  const added=await db.query(`INSERT INTO admin_event_notifications(event_key,permission_code,title,entity_id,target)
   VALUES($1,'system.monitor','System Health',$2,'/health') ON CONFLICT(event_key) DO NOTHING RETURNING id`,[key,entity]);
  if(added.rows.length)await db.query(`INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes)
   VALUES('service','technical-monitor','security.monitor.alert','technical_health',$1,$2,$3)`,
   [entity,randomUUID(),JSON.stringify({codes:normalized,financialMutation:false})]);
  await db.query('COMMIT');return {delivered:true,inserted:added.rows.length===1};
 }catch(error){await db.query('ROLLBACK');throw error;}
}
module.exports={deliver,allowed};
if(!module.parent){
 const fs=require('node:fs');const{Client}=require('/app/node_modules/pg');
 const db=new Client({connectionString:fs.readFileSync(process.env.DATABASE_URL_FILE,'utf8').trim()});
 (async()=>{const input=fs.readFileSync(0,'utf8');if(input.length>4096)throw Error();
  const b=JSON.parse(input);await db.connect();process.stdout.write(JSON.stringify(await deliver(db,b.codes,b.bucket)));
 })().catch(()=>{process.exitCode=1}).finally(()=>db.end());
}

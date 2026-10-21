// Fixed-column metadata only. No password/session/OTP/bank/proof fields or
// arbitrary sanitized_changes/context/reason strings can enter this collector.
// Used only inside the VPS; stdout goes into age encryption, never a terminal.
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const id=v=>typeof v==='string'&&UUID.test(v)?v:null;
const actions=new Set(['admin.login','manual.transition','manual.file_read','manual.bank_reveal',
 'manual.deposit_policy.changed','manual.deposit_wallet.changed','android.publish','review.acknowledged',
 'referral.claim','referral.review','referral.reward','referral.registration_review',
 'referral.registration_qualified','referral.policy.changed','referral.reward.released',
 'owner.user.closed','owner.bank.revealed','owner.bank.disabled','owner.user.edit','owner.user.note',
 'owner.wallet.adjustment','owner.bank.corrected','owner.deposit.amended',
 'payout.note','payout.completed','payout.failed','payout.proof_uploaded','security.monitor.alert']);
for(const state of ['queued','submitted','processing','success','returned','rejected','cancelled','unknown','retry','review','reconcile'])actions.add('payout.'+state);
const states=new Set(['PROOF_SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','CREDITED','REQUIRES_MORE_INFORMATION',
 'PAYOUT_IN_PROGRESS','PROCESSING','SUBMITTED','QUEUED','COMPLETED','SUCCESS','FAILED','RETURNED','CANCELLED']);
const specs={
 audit_logs:"id,actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes->>'from' AS from_status,sanitized_changes->>'to' AS to_status",
 login_history:'id,user_id,success',
 risk_flags:'id,user_id,order_id,severity,state'
};
function sanitize(table,row){
 const result={table,id:id(row.id),createdAt:row.created_at};
 if(table==='audit_logs')Object.assign(result,{
  actorType:['user','admin','service'].includes(row.actor_type)?row.actor_type:'unknown',
  actorId:id(row.actor_id),entityId:id(row.entity_id),requestId:id(row.request_id),
  action:actions.has(row.action)?row.action:'other_audited_action',
  fromStatus:states.has(row.from_status)?row.from_status:null,toStatus:states.has(row.to_status)?row.to_status:null});
 if(table==='login_history')Object.assign(result,{userId:id(row.user_id),success:row.success===true});
 if(table==='risk_flags')Object.assign(result,{userId:id(row.user_id),orderId:id(row.order_id),
  severity:['low','medium','high','critical'].includes(row.severity)?row.severity:'unknown',
  state:['open','reviewing','resolved'].includes(row.state)?row.state:'unknown'});
 return result;
}
async function page(db,input,now=Date.now()){
 // Periodic complete paginated scans also capture late commits/backfilled times
 // and mutable risk states. No destructive cursor/watermark on source tables.
 const cursor=JSON.parse(JSON.stringify(input||{}));
 if(cursor.completedAt && now-cursor.completedAt<6*3600*1000)return {records:[],cursor};
 if(cursor.completedAt){for(const k of Object.keys(cursor))delete cursor[k];}
 const records=[];
 await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{
  await db.query("SET LOCAL statement_timeout='15s'");
  if(!cursor.until)cursor.until=(await db.query("SELECT to_char(now()-interval '2 minutes','YYYY-MM-DD\"T\"HH24:MI:SS.USOF') AS time")).rows[0].time;
  for(const [table,columns] of Object.entries(specs)){
   const c=cursor[table]||{};if(c.done)continue;
   const result=await db.query(`SELECT ${columns},to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at
    FROM ${table} WHERE created_at <= $1::timestamptz
    AND ($2::timestamptz IS NULL OR (created_at,id)>($2::timestamptz,$3::uuid))
    ORDER BY created_at,id LIMIT 500`,[cursor.until,c.time||null,c.id||null]);
   records.push(...result.rows.map(row=>sanitize(table,row)));
   const last=result.rows.at(-1);
   cursor[table]={done:result.rows.length<500,...(last?{time:last.created_at,id:last.id}:{})};
  }
  if(Object.keys(specs).every(k=>cursor[k]?.done))cursor.completedAt=now;
  await db.query('COMMIT');return {records,cursor};
 }catch(error){await db.query('ROLLBACK');throw error;}
}
module.exports={page,sanitize};
if(!module.parent){
 const fs=require('node:fs');const{Client}=require('/app/node_modules/pg');
 const db=new Client({connectionString:fs.readFileSync(process.env.DATABASE_URL_FILE,'utf8').trim()});
 (async()=>{const input=fs.readFileSync(0,'utf8');if(input.length>32768)throw Error();
  await db.connect();process.stdout.write(JSON.stringify(await page(db,JSON.parse(input))));
 })().catch(()=>{process.exitCode=1}).finally(()=>db.end());
}

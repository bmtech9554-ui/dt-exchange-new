// Explicit developer-operated provider simulator. Never called by normal workers.
import { Client } from 'pg';
import { createHmac, randomUUID } from 'node:crypto';
if(!['development','test'].includes(process.env.NODE_ENV??'development')||process.env.PAYOUT_PROVIDER!=='mock'||!process.argv.includes('--sandbox-confirm'))throw new Error('Explicit non-production mock mode required');
const [key,status,utr]=process.argv.slice(2);
if(!key||!['PROCESSING','SUCCESS','FAILED','REVERSED'].includes(status)||status==='SUCCESS'&&!/^SANDBOX-[\w-]+$/.test(utr??''))throw new Error('Usage: request-key STATUS [SANDBOX-UTR] --sandbox-confirm');
const db=new Client({connectionString:process.env.DATABASE_URL});await db.connect();
try{
 const r=(await db.query("UPDATE sandbox_payout_records SET status=$2,utr=CASE WHEN $2='SUCCESS' THEN $3 ELSE utr END,failure_code=CASE WHEN $2='FAILED' THEN 'SANDBOX_REJECTED' ELSE NULL END,updated_at=now() WHERE request_key=$1 RETURNING *",[key,status,status==='SUCCESS'?utr:null])).rows[0];if(!r)throw new Error('Sandbox request not found');
 if(process.env.SANDBOX_WEBHOOK_URL){const secret=process.env.PAYOUT_WEBHOOK_SECRET;if(!secret||secret.length<32)throw new Error('Webhook secret required');const timestamp=String(Math.floor(Date.now()/1000));const body=JSON.stringify({eventId:randomUUID(),result:{requestKey:key,reference:r.provider_ref,amountMinor:String(r.amount_inr_minor),status:r.status,utr:r.utr??undefined,failureCode:r.failure_code??undefined,definitiveFailure:r.status==='FAILED',reversalReference:r.status==='REVERSED'?r.provider_ref:undefined}});const signature=createHmac('sha256',secret).update(timestamp+'.'+body).digest('hex');const response=await fetch(process.env.SANDBOX_WEBHOOK_URL,{method:'POST',headers:{'content-type':'application/json','x-payout-timestamp':timestamp,'x-payout-signature':signature},body,signal:AbortSignal.timeout(10000),redirect:'error'});if(!response.ok)throw new Error('Sandbox webhook delivery failed');}
 console.log(JSON.stringify({sandbox:true,status,noRealTransfer:true}));
}finally{await db.end();}

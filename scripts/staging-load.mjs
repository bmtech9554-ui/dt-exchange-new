/** Bounded staging-only probes. Never load-test an external financial provider. */
import {randomUUID} from 'node:crypto';
const base=new URL(process.env.STAGING_API_URL??'');
if(process.env.DT_STAGING_LOAD_APPROVED!=='isolated-staging'||!['localhost','127.0.0.1'].includes(base.hostname)&&!base.hostname.startsWith('staging.'))throw new Error('Isolated staging approval required');
if(base.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(base.hostname))throw new Error('HTTPS required');
const mode=process.env.LOAD_MODE??'reads';
if(!['reads','rates','quotes','auth','admin'].includes(mode))throw new Error('Invalid mode');
const count=Math.min(100,Math.max(1,Number(process.env.LOAD_REQUESTS??30)));
if(!Number.isInteger(count))throw new Error('Invalid request count');
const endpoint=path=>base.toString().replace(/\/$/,'')+path;
if(['rates','quotes'].includes(mode)){const rate=await fetch(endpoint('/rates/usdt-inr'),{headers:{authorization:'Bearer '+(process.env.STAGING_USER_TOKEN??'')},signal:AbortSignal.timeout(10000)});if(!rate.ok||(await rate.json()).sandbox!==true)throw new Error('Rate/quote load requires explicitly mocked rate source');}
const paths=mode==='admin'?['/admin/operations/dashboard','/admin/operations/users']:mode==='rates'?['/rates/usdt-inr']:mode==='quotes'?['/sell/quote']:mode==='auth'?['/auth/login']:['/transactions','/notifications','/users/me'];
if(mode==='auth'&&(!process.env.STAGING_LOGIN_IDENTIFIER||!process.env.STAGING_LOGIN_PASSWORD))throw new Error('Dedicated staging login required');
const started=Date.now();let errors=0;const timings=[];
for(let i=0;i<count;i++){
 const t=Date.now(),body=mode==='quotes'?{amountUsdt:process.env.STAGING_QUOTE_USDT??'10',bankAccountId:process.env.STAGING_BANK_ID}:mode==='auth'?{contact:process.env.STAGING_LOGIN_IDENTIFIER,password:process.env.STAGING_LOGIN_PASSWORD,deviceId:'staging-load'}:undefined;
 const r=await fetch(endpoint(paths[i%paths.length]),{method:body?'POST':'GET',headers:{authorization:'Bearer '+(mode==='admin'?process.env.STAGING_ADMIN_TOKEN??'':process.env.STAGING_USER_TOKEN??''),'content-type':'application/json','idempotency-key':randomUUID()},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
 timings.push(Date.now()-t);if(!r.ok)errors++;await r.arrayBuffer();await new Promise(r=>setTimeout(r,500));
}
timings.sort((a,b)=>a-b);console.log(JSON.stringify({mode,requests:count,errors,durationMs:Date.now()-started,p95Ms:timings[Math.floor(timings.length*.95)]}));if(errors)process.exitCode=1;

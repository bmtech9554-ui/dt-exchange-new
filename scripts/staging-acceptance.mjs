// Read-only smoke probe. No credentials printed and no financial requests created.
const base=process.env.STAGING_API_URL;
if(!base||process.env.DEPLOYMENT_ENV!=='staging'||new URL(base).protocol!=='https:')throw new Error('Explicit HTTPS staging configuration required');
const checks=[];
for(const path of ['/health/live','/health/ready','/system/status','/rates/usdt-inr']) {
 const start=performance.now();try{const r=await fetch(base.replace(/\/$/,'')+path,{signal:AbortSignal.timeout(10000),redirect:'error',headers:process.env.STAGING_USER_TOKEN?{authorization:'Bearer '+process.env.STAGING_USER_TOKEN}:{}});checks.push({path,status:r.status,durationMs:Math.round(performance.now()-start),pass:r.ok});await r.body?.cancel();}catch{checks.push({path,pass:false,result:'UNAVAILABLE'});}
}
console.log(JSON.stringify({environment:'staging',financialActions:0,checks},null,2));if(checks.some(x=>!x.pass))process.exitCode=1;

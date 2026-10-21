// Offline only. Reads approved secret-file inputs; reports statuses, never values/paths/errors.
import {readFileSync,statSync} from 'node:fs';
import {setupReport} from '../dist/config/setup-report.js';
const source={...process.env},invalid={};
const secrets=['DATABASE_URL','REDIS_URL','JWT_PRIVATE_KEY_B64','JWT_PUBLIC_KEY_B64','DATA_ENCRYPTION_KEY','LOOKUP_HASH_KEY','OTP_HASH_KEY','TRON_API_KEY','PAYOUT_API_KEY','PAYOUT_API_SECRET','PAYOUT_WEBHOOK_SECRET','EMAIL_API_KEY','SMS_API_KEY','SUPPORT_STORAGE_KEY','CUSTODY_PROVIDER_API_KEY'];
for(const name of secrets){const path=source[name+'_FILE'];if(!path)continue;try{if(source[name])throw new Error();const st=statSync(path);if(!st.isFile()||st.size>65536)throw new Error();source[name]=readFileSync(path,'utf8').trim();}catch{invalid[name]='invalid';}}
const result={...setupReport(source),...invalid};console.log(JSON.stringify(result,null,2));if(Object.values(result).some(x=>x!=='configured'))process.exitCode=2;
// A clean configuration report cannot register adapters or certify connectivity/release readiness.

import {readFileSync,statSync} from 'node:fs';
import {createRequire} from 'node:module';
const names=['DVCONNECT_API_KEY','BLACKSMS_API_KEY','DATABASE_URL','REDIS_URL','JWT_PRIVATE_KEY_B64','JWT_PUBLIC_KEY_B64','DATA_ENCRYPTION_KEY','LOOKUP_HASH_KEY','OTP_HASH_KEY','TRON_API_KEY','PAYOUT_API_KEY','PAYOUT_API_SECRET','PAYOUT_WEBHOOK_SECRET','EMAIL_API_KEY','SMS_API_KEY','PUSH_CREDENTIALS','STORAGE_ACCESS_KEY','STORAGE_SECRET_KEY'];
for(const key of names){const path=process.env[key+'_FILE'];if(!path)continue;if(process.env[key])throw new Error('Ambiguous secret source: '+key);const stat=statSync(path);if(!stat.isFile()||stat.size>65536)throw new Error('Invalid secret file: '+key);process.env[key]=readFileSync(path,'utf8').trim();}
const targets={api:'main',blockchain:'blockchain-worker',payouts:'payout-worker',engagement:'engagement-worker'};
const target=targets[process.argv[2]??'api'];if(!target)throw new Error('Invalid service');
const require=createRequire(import.meta.url);
const {assertProduction}=require('../dist/config/production.js');
try{assertProduction();}catch{console.error(JSON.stringify({event:'startup_rejected',reason:'UNSAFE_OR_UNIMPLEMENTED_PRODUCTION_CONFIGURATION'}));process.exit(1);}
if(target==='main'){const {createApp}=require('../dist/main.js');const {environment}=require('../dist/config/environment.js');await (await createApp()).listen(environment.PORT,environment.HOST);}else require('../dist/'+target+'.js');

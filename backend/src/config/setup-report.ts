import {createPrivateKey,createPublicKey} from 'node:crypto';
import {validTronAddress} from '../modules/blockchain/tron-address';
export type ConfigurationStatus='configured'|'missing'|'invalid';
export function safePublicHttps(value:string):boolean {
 try {const u=new URL(value),h=u.hostname.toLowerCase();return u.protocol==='https:'&&!h.includes('*')&&!u.username&&!u.password&&!u.hash&&!['localhost','127.0.0.1','0.0.0.0','[::1]'].includes(h)&&!h.endsWith('.localhost')&&!h.endsWith('.local');}catch{return false;}
}
/** Offline syntax/inventory checks only; never returns configuration values. */
export function setupReport(s:NodeJS.ProcessEnv){
 const manual=s.MANUAL_DEPOSIT_REVIEW==='true'&&s.MANUAL_PAYOUT==='true';
 const optional=new Set(['TRON_API_KEY','PAYOUT_API_URL','PAYOUT_PROVIDER','PAYOUT_API_KEY','PAYOUT_API_SECRET','PAYOUT_WEBHOOK_SECRET','CUSTODY_API_URL','CUSTODY_PROVIDER','CUSTODY_PROVIDER_API_KEY']);
 if(s.TRANSACTIONS_ENABLED!=='true')optional.add('TRON_API_URL');
 const result:Record<string,ConfigurationStatus>={};
 const check=(name:string,validate:(value:string)=>boolean=()=>true)=>{if(manual&&optional.has(name))return;const v=s[name];try{result[name]=!v?'missing':validate(v)?'configured':'invalid';}catch{result[name]='invalid';}};
 check('APP_ENV',v=>v==='production'&&s.NODE_ENV==='production'&&(!s.DEPLOYMENT_ENV||s.DEPLOYMENT_ENV===v));
 for(const name of ['API_PUBLIC_URL','ADMIN_PUBLIC_URL','PUBLIC_SITE_URL','TRON_API_URL','PAYOUT_API_URL','EMAIL_API_URL','SMS_API_URL','SUPPORT_STORAGE_ENDPOINT','CUSTODY_API_URL'])check(name,safePublicHttps);
 check('CORS_ORIGINS',v=>v.split(',').every(x=>safePublicHttps(x.trim())&&new URL(x.trim()).origin===x.trim()));
 check('DATABASE_URL',v=>{const u=new URL(v);return ['postgres:','postgresql:'].includes(u.protocol)&&!!u.username&&decodeURIComponent(u.password).length>=16&&u.searchParams.get('sslmode')==='verify-full';});
 check('REDIS_URL',v=>{const u=new URL(v);return u.protocol==='rediss:'&&!!u.username&&decodeURIComponent(u.password).length>=16;});
 for(const name of ['DATA_ENCRYPTION_KEY','LOOKUP_HASH_KEY','OTP_HASH_KEY'])check(name,v=>/^[A-Za-z0-9+/]{43}=$/.test(v)&&Buffer.from(v,'base64').length===32);
 for(const name of ['JWT_PRIVATE_KEY_B64','JWT_PUBLIC_KEY_B64'])check(name);
 if(s.JWT_PRIVATE_KEY_B64&&s.JWT_PUBLIC_KEY_B64){try{const priv=createPrivateKey(Buffer.from(s.JWT_PRIVATE_KEY_B64,'base64')),pub=createPublicKey(Buffer.from(s.JWT_PUBLIC_KEY_B64,'base64'));if(priv.asymmetricKeyType!=='rsa'||(priv.asymmetricKeyDetails?.modulusLength??0)<2048||!createPublicKey(priv).export({type:'spki',format:'der'}).equals(pub.export({type:'spki',format:'der'})))throw new Error();}catch{result.JWT_PRIVATE_KEY_B64=result.JWT_PUBLIC_KEY_B64='invalid';}}
 for(const name of ['TRON_PROVIDER','PAYOUT_PROVIDER','VERIFICATION_PROVIDER','RATE_PROVIDER','OTP_PROVIDER','EMAIL_PROVIDER','SMS_PROVIDER','PUSH_PROVIDER','SUPPORT_STORAGE_PROVIDER','CUSTODY_PROVIDER'])check(name,v=>!/mock|dev|sandbox/i.test(v));
 for(const name of ['TRON_API_KEY','PAYOUT_API_KEY','PAYOUT_API_SECRET','PAYOUT_WEBHOOK_SECRET','EMAIL_API_KEY','SMS_API_KEY','SUPPORT_STORAGE_KEY','CUSTODY_PROVIDER_API_KEY'])check(name,v=>v.length>=16&&!/^(password|placeholder|changeme|default|replace)/i.test(v));
 check('TRON_USDT_CONTRACT',validTronAddress);check('TRON_REQUIRED_CONFIRMATIONS',v=>/^[1-9][0-9]*$/.test(v)&&Number(v)<=10000);
 check('BLOCKCHAIN_NETWORK',v=>v==='mainnet');check('TRON_NETWORK',v=>v==='tron-mainnet');
 check('PUSH_PROJECT_ID');check('PUSH_CREDENTIALS_FILE');check('SUPPORT_STORAGE_BUCKET');check('METRICS_ENABLED',v=>v==='true');
 for(const name of ['DEBUG','API_DEBUG','ADMIN_DEBUG','DEMO_MODE','ALLOW_TEST_ENDPOINTS','MOCK_PROVIDER','DEV_OTP_EXPOSE'])check(name,v=>['false','0'].includes(v.toLowerCase()));
 if(manual){check('AUTOMATED_BLOCKCHAIN_CREDIT',v=>v==='false');check('AUTOMATED_PAYOUT',v=>v==='false');check('MANUAL_COLLECTION_ADDRESS',validTronAddress);check('PRIVATE_FINANCIAL_STORAGE',v=>v==='postgres-encrypted');check('ANDROID_UPDATE_ENFORCED',v=>v==='true');check('APK_ALLOWED_ORIGINS',v=>v.split(',').every(x=>safePublicHttps(x)&&new URL(x).origin===x));check('APK_RELEASE_PUBLIC_KEY_B64',v=>createPublicKey(Buffer.from(v,'base64')).asymmetricKeyType==='ed25519');}
 return result;
}

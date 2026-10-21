import 'reflect-metadata';
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const keys=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
Object.assign(process.env,{NODE_ENV:'test',PUBLIC_TEST_MODE:'true',DATABASE_URL:'postgresql://test@localhost/dtexchange_public_test',PUBLIC_TEST_REAL_MONEY:'false',PUBLIC_TEST_ORIGIN:'https://dtexchange.app',TRON_PROVIDER:'mock',TRON_NETWORK:'tron-mock',TRON_REQUIRED_CONFIRMATIONS:'3',OTP_PROVIDER:'dev',DEV_OTP_EXPOSE:'true',VERIFICATION_PROVIDER:'mock',RATE_PROVIDER:'mock',PAYOUT_PROVIDER:'mock',MANUAL_DEPOSIT_REVIEW:'true',MANUAL_PAYOUT:'true',AUTOMATED_BLOCKCHAIN_CREDIT:'false',AUTOMATED_PAYOUT:'false',TRANSACTIONS_ENABLED:'true',PAYOUTS_ENABLED:'true',REFERRAL_PROGRAM_PAUSED:'true',MANUAL_COLLECTION_ADDRESS:'DT-TEST-NONPAYABLE-NO-REAL-USDT',PAYOUT_MAX_AMOUNT:'51500000',OWNER_WALLET_ADJUSTMENTS_ENABLED:'false',REFERRAL_REWARD_RELEASE_ENABLED:'false',JWT_PRIVATE_KEY_B64:Buffer.from(keys.privateKey).toString('base64'),JWT_PUBLIC_KEY_B64:Buffer.from(keys.publicKey).toString('base64'),DATA_ENCRYPTION_KEY:randomBytes(32).toString('base64'),LOOKUP_HASH_KEY:randomBytes(32).toString('base64'),OTP_HASH_KEY:randomBytes(32).toString('base64')});
delete process.env.REDIS_URL;
const {DatabaseService}=await import('../dist/common/database.service.js');
const {CryptoService}=await import('../dist/common/crypto.service.js');
const {assertPublicTestIsolation,publicTestRouteAllowed}=await import('../dist/public-test/isolation.js');
const {totp}=await import('../dist/modules/admin/admin.module.js');
let db,app,url,session,admin,other,deposit,bank,order,proof,receipt,aid;
const password=randomBytes(24).toString('base64url');
const seed='JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const bytes=await readFile(new URL('../../mobile/assets/test/synthetic-receipt.png',import.meta.url));
async function call(path,method='GET',body,token=session?.accessToken,key){
 const res=await fetch(url+path,{method,headers:{'content-type':'application/json',origin:'https://dtexchange.app',...(token?{authorization:'Bearer '+token}:{}),...(key?{'idempotency-key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')};
}
async function upload(token,purpose){const form=new FormData();form.set('purpose',purpose);form.set('file',new Blob([bytes],{type:'image/png'}),'TEST-NO-PAYMENT.png');const r=await fetch(url+(purpose==='receipt'?'/admin':'')+'/manual/files',{method:'POST',headers:{authorization:'Bearer '+token},body:form});assert.equal(r.status,201);return (await r.json()).id;}
before(async()=>{
 db=new PGlite();
 const {initializePublicTest}=await import('../scripts/public-test-initialize.mjs');await initializePublicTest(db);
 DatabaseService.prototype.query=function(s,p=[]){return db.query(s,p)};
 DatabaseService.prototype.transaction=function(f){return db.transaction(tx=>f(tx))};
 DatabaseService.prototype.onModuleDestroy=async function(){/* test pool was never used */};
 const {createPublicTestApp}=await import('../dist/public-test/main.js');app=await createPublicTestApp();app.useLogger(false);await app.listen(0,'127.0.0.1');url=(await app.getUrl())+'/api/v1';
 const c=app.get(CryptoService);aid=randomUUID();
 await db.query("INSERT INTO admin_users(id,email_lookup_hash,email_ciphertext,password_hash,status,totp_secret_ciphertext) VALUES($1,$2,$3,$4,'active',$5)",[aid,c.digest('test-admin@example.invalid','email'),c.encrypt('test-admin@example.invalid','admin-email:'+aid),await c.password(password),c.encrypt(seed,'admin-totp:'+aid)]);
 await db.query("INSERT INTO admin_user_roles(admin_user_id,role_id) SELECT $1,id FROM admin_roles WHERE name='OWNER_ADMIN'",[aid]);
});
after(async()=>{await app?.close();await db?.close()});
test('public test refuses production database, providers, automation and normal credentials routes',()=>{
 assertPublicTestIsolation();for(const patch of [{NODE_ENV:'production'},{DATABASE_URL:'postgres://test@production/dtexchange'},{AUTOMATED_PAYOUT:'true'},{DVCONNECT_API_KEY:'forbidden'}])assert.throws(()=>assertPublicTestIsolation({...process.env,...patch}));
 for(const path of ['/auth/request-otp','/auth/register','/auth/reset-password','/wallet/deposit-address','/_fixture/bootstrap','/admin/manual/releases','/admin/owner/config/rates'])assert.equal(publicTestRouteAllowed('POST','/api/v1'+path),false,path);
});
test('test registration and password login work without real contacts; OTP/reset are inaccessible',async()=>{
 const r=await call('/test/register','POST',{username:'tester_one',password,deviceId:'test-device-one'},null);assert.equal(r.status,201);session=r.body;assert(session.accessToken);assert.equal(r.body.developmentOtp,undefined);
 const two=await call('/test/register','POST',{username:'tester_two',password,deviceId:'test-device-two'},null);assert.equal(two.status,201);other=two.body;
 const me=await call('/users/me');assert.equal(me.status,200);assert.equal(me.body.publicUserId,'1000');
 assert.equal((await call('/test/login','POST',{username:'tester_one',password:'wrong-password',deviceId:'test-device-one'},null)).status,401);
 assert.equal((await call('/test/login','POST',{username:'tester_one',password,deviceId:'test-device-one'},null)).status,201);
 assert.equal((await call('/auth/request-otp','POST',{contact:'tester_one@public-test.invalid',purpose:'login'},null)).status,403);
});
test('test admin requires password plus TOTP and issues a separate secure cookie',async()=>{
 assert.equal((await call('/admin/login','POST',{email:'test-admin@example.invalid',password},null)).status,401);
 const r=await call('/admin/login','POST',{email:'test-admin@example.invalid',password,code:totp(seed,Math.floor(Date.now()/30000))},null);assert.equal(r.status,201);assert.equal(r.body.accessToken,undefined);assert(r.cookie?.includes('HttpOnly'));assert(r.cookie?.includes('Secure'));assert(r.cookie?.includes('SameSite=Strict'));admin=r.cookie.match(/dt_test_admin=([^;]+)/)[1];
 assert.equal((await call('/admin/access','GET',undefined,admin)).status,200);
});
test('generated deposit reference, protected proof, limits and duplicate protection retain manual review',async()=>{
 const cfg=await call('/manual/configuration');assert.equal(cfg.body.address,'DT-TEST-NONPAYABLE-NO-REAL-USDT');assert.equal(cfg.body.depositFeeUsdt,'0');assert.equal(cfg.body.minimumDeposit,'100');assert.equal(cfg.body.monthlyDepositLimit,null);
 proof=await upload(session.accessToken,'proof');
 const txHash=(await call('/test/reference','POST',{})).body.txHash;
 const body={amountUsdt:'100',network:'TRC20',txHash,proofId:proof,note:'PUBLIC TEST ONLY - no real transfer'};
 assert.equal((await call('/manual/deposits','POST',{...body,txHash:'a'.repeat(64)},undefined,randomUUID())).status,400);
 assert.equal((await call('/manual/deposits','POST',{...body,amountUsdt:'99'},undefined,randomUUID())).status,400);
 const r=await call('/manual/deposits','POST',body,undefined,randomUUID());assert.equal(r.status,201);deposit=r.body.id;
 assert.equal((await call('/manual/deposits','POST',body,undefined,randomUUID())).status,409);
 assert.equal((await call('/wallet')).body.availableUsdt,'0');
 assert.equal((await call('/manual/files/'+proof,'GET',undefined,other.accessToken)).status,404);
 assert.equal((await call('/manual/files/'+proof,'GET',undefined,null)).status,401);
});
test('only authorized test reviewer credits the isolated demo ledger exactly once',async()=>{
 assert.equal((await call('/test/admin/deposits/'+deposit+'/approve','POST',{confirmSimulation:true})).status,401);
 assert.equal((await call('/admin/manual/deposits/'+deposit+'/review','POST',{action:'start',note:'Start synthetic test review'},admin)).status,201);
 for(let i=0;i<2;i++)assert.equal((await call('/test/admin/deposits/'+deposit+'/approve','POST',{confirmSimulation:true},admin)).status,201);
 assert.equal((await call('/wallet')).body.availableUsdt,'100.000000000000000000');
 assert.equal((await db.query('SELECT * FROM ledger_integrity_issues')).rows.length,0);
});
test('demo bank, 103 rate, 60-second quotes and sell request use wallet funds and enforce 5000 maximum',async()=>{
 const b=await call('/test/bank','POST',{});assert.equal(b.status,201);bank=b.body;
 assert.equal(bank.ifsc,'DEMO0000000');assert.equal((await call('/bank-accounts','POST',{accountNumber:'1234567890'})).status,403);
 assert.equal((await call('/sell/quote','POST',{amountUsdt:'5001'},undefined,randomUUID())).status,400);
 const q=await call('/sell/quote','POST',{amountUsdt:'100'},undefined,randomUUID());assert.equal(q.status,201);assert.equal(q.body.finalInrMinor,'1030000');assert.equal(q.body.feeInrMinor,'0');assert(Math.abs(Date.parse(q.body.expiresAt)-Date.parse(q.body.createdAt)-60000)<1000);
 const o=await call('/sell/orders','POST',{quoteId:q.body.quoteId,bankAccountId:bank.id},undefined,randomUUID());assert.equal(o.status,201);order=o.body.orderId;
});
test('manual demo payout, receipt and History complete without payment provider access',async()=>{
 assert.equal((await call('/admin/manual/payouts/'+order+'/process','POST',{note:'Simulation review only; no transfer'},admin)).status,201);
 receipt=await upload(admin,'receipt');
 const r=await call('/test/admin/payouts/'+order+'/simulate','POST',{confirmSimulation:true,receiptId:receipt,demoUtr:'DEMO-RECEIPT-001'},admin);assert.equal(r.status,201);assert.equal(r.body.status,'COMPLETED');assert.equal(r.body.utr,'SIMULATED-DEMO-RECEIPT-001');
 assert.equal((await call('/manual/files/'+receipt)).status,200);assert.equal((await call('/manual/files/'+receipt,'GET',undefined,other.accessToken)).status,404);
 const p=(await db.query('SELECT id FROM payouts WHERE order_id=$1',[order])).rows[0];
 assert.equal((await call('/history/'+p.id)).body.manual_receipt_id,receipt);
 assert.equal((await db.query('SELECT * FROM ledger_integrity_issues')).rows.length,0);
 assert.equal((await db.query("SELECT count(*)::int n FROM admin_event_notifications WHERE event_key=$1",['manual_deposit_requests:'+deposit])).rows[0].n,1);
 assert.equal((await db.query("SELECT count(*)::int n FROM admin_event_notifications WHERE event_key=$1",['sell_orders:'+order])).rows[0].n,1);
 await (await import('../scripts/public-test-initialize.mjs')).initializePublicTest(db);
 assert.equal((await db.query('SELECT count(*)::int n FROM manual_deposit_requests WHERE id=$1',[deposit])).rows[0].n,1);
});

test('interactive simulation OTP is expiring, attempt checked and single use without sending SMS',async()=>{
 const r=await call('/test/register-challenge','POST',{username:'demo_challenge',password,deviceId:'simulation-device'},null);
 assert.equal(r.status,201);assert.equal(r.body.realSms,false);assert.equal(r.body.accessToken,undefined);
 assert.match(r.body.simulationCode,/^\d{6}$/);
 const body={challengeId:r.body.challengeId,code:r.body.simulationCode,deviceId:'simulation-device'};
 assert.equal((await call('/test/verify','POST',{...body,code:body.code==='000000'?'000001':'000000'},null)).status,401);
 assert.equal((await call('/test/verify','POST',body,null)).status,201);
 assert.equal((await call('/test/verify','POST',body,null)).status,401);
 const expired=await call('/test/register-challenge','POST',{username:'demo_expired',password,deviceId:'simulation-expired'},null);
 await db.query("UPDATE otp_challenges SET expires_at=now()-interval '1 second' WHERE id=$1",[expired.body.challengeId]);
 assert.equal((await call('/test/verify','POST',{challengeId:expired.body.challengeId,code:expired.body.simulationCode,deviceId:'simulation-expired'},null)).status,401);
});

test('demo deposit proof is optional only within the validated isolated configuration',async()=>{
 const txHash=(await call('/test/reference','POST',{},other.accessToken)).body.txHash;
 const r=await call('/manual/deposits','POST',{amountUsdt:'100',network:'TRC20',txHash},other.accessToken,randomUUID());
 assert.equal(r.status,201);assert.equal(r.body.proof_id,null);
 assert.equal((await call('/wallet','GET',undefined,other.accessToken)).body.availableUsdt,'0');
 assert.equal((await call('/manual/deposits','POST',{amountUsdt:'100',network:'TRC20',txHash,proofId:'not-a-proof'},other.accessToken,randomUUID())).status,400);
});

test('already spent demo balance cannot be spent again',async()=>{
 const q=await call('/sell/quote','POST',{amountUsdt:'100'},undefined,randomUUID());assert.equal(q.status,201);
 assert.equal((await call('/sell/orders','POST',{quoteId:q.body.quoteId,bankAccountId:bank.id},undefined,randomUUID())).status,409);
 assert.equal((await db.query('SELECT * FROM ledger_integrity_issues')).rows.length,0);
});

test('demo user management is permission checked, versioned, audited and revokes frozen sessions',async()=>{
 const me=(await call('/users/me','GET',undefined,other.accessToken)).body;
 const list=await call('/admin/owner/users','GET',undefined,admin);assert.equal(list.status,200);
 const user=list.body.items.find(u=>u.id===me.id);assert(user);
 const body={confirm:true,status:'frozen',version:user.version};
 assert.equal((await call('/test/admin/users/'+me.id+'/status','POST',body)).status,401);
 assert.equal((await call('/test/admin/users/'+me.id+'/status','POST',{...body,version:user.version+100},admin)).status,409);
 assert.equal((await call('/test/admin/users/'+me.id+'/status','POST',body,admin)).status,201);
 assert([401,403].includes((await call('/users/me','GET',undefined,other.accessToken)).status));
 assert.equal((await db.query("SELECT count(*)::int n FROM audit_logs WHERE action='simulation.user.status' AND entity_id=$1",[me.id])).rows[0].n,1);
 assert.equal((await db.query('SELECT * FROM ledger_integrity_issues')).rows.length,0);
});

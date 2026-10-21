import "reflect-metadata";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes, randomUUID, createHmac } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
const keys = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
Object.assign(process.env, {
  NODE_ENV: "test", MANUAL_DEPOSIT_REVIEW:"true",MANUAL_PAYOUT:"true",AUTOMATED_BLOCKCHAIN_CREDIT:"false",AUTOMATED_PAYOUT:"false",MANUAL_COLLECTION_ADDRESS:"DT-MOCK-COLLECTION", PAYOUTS_ENABLED:"true", PAYOUT_PROVIDER:"mock", PAYOUT_FAILED_ATTEMPT_LIMIT:"100", PAYOUT_BANK_COOLDOWN_SECONDS:"0", PAYOUT_WEBHOOK_SECRET:randomBytes(32).toString("hex"),
  TRANSACTIONS_ENABLED:"true", TRON_PROVIDER:"mock", TRON_NETWORK:"tron-mock", TRON_REQUIRED_CONFIRMATIONS:"3",
  OTP_PROVIDER: "dev",
  DEV_OTP_EXPOSE: "true",
  VERIFICATION_PROVIDER: "mock",
  MOCK_VERIFICATION_DECISION: "verified",
  RATE_PROVIDER: "mock",
  JWT_PRIVATE_KEY_B64: Buffer.from(keys.privateKey).toString("base64"),
  JWT_PUBLIC_KEY_B64: Buffer.from(keys.publicKey).toString("base64"),
  DATA_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  LOOKUP_HASH_KEY: randomBytes(32).toString("base64"),
  OTP_HASH_KEY: randomBytes(32).toString("base64"),
});
const { AppModule } = await import("../dist/app.module.js");
const { DatabaseService } = await import("../dist/common/database.service.js");
const { HttpErrorFilter } = await import(
  "../dist/common/http-exception.filter.js"
);
const { calculateRate, calculateFee, decimal, databaseUnits } = await import(
  "../dist/modules/rates/money.js"
);
const { seedPhase3 } = await import("../scripts/seed-phase3.mjs");
let db, app, url, token, uid, bank, provider, deposits;
const password = "correct horse battery staple";
async function call(path, { method = "GET", body, auth = token, key, version, totpCode } = {}) {
  const r = await fetch(url + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(version ? {"x-dt-version-code":version}:{}),
      ...(totpCode ? {"x-dt-admin-totp":totpCode}:{}),
      ...(auth ? { authorization: "Bearer " + auth } : {}),
      ...(key ? { "idempotency-key": key } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
const post = (path, body, extra = {}) =>
  call(path, { method: "POST", body, ...extra });
before(async () => {
  db = process.env.PHASE6_POSTGRES_URL ? await (await import('./postgres-harness.mjs')).realDatabase() : new PGlite();
  for (const f of (
    await readdir(new URL("../migrations/", import.meta.url))
  ).sort())
    await db.exec(
      await readFile(new URL("../migrations/" + f, import.meta.url), "utf8"),
    );
  await db.exec(
    await readFile(
      new URL("../seeds/001_reference.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec("CREATE TABLE schema_migrations(name text PRIMARY KEY,checksum text); INSERT INTO schema_migrations VALUES('007_operational_readiness.sql','test-applied');");
  await db.query("INSERT INTO system_settings(key,value) VALUES('manual_deposit_policy',$1)",[JSON.stringify({minimumDeposit:'100',dailyDepositLimit:'20000',monthlyDepositLimit:null,monthlyLimitEnabled:false})]);
  await seedPhase3(db);
  await (await import("../scripts/seed-phase6.mjs")).seedPhase6(db);
  const {seedPhase4}=await import("../scripts/seed-phase4.mjs");await seedPhase4(db);
  // Use actual Nest controllers/guards/DTOs/services against PostgreSQL WASM.
  DatabaseService.prototype.query = function (sql, params = []) {
    return db.query(sql, params);
  };
  DatabaseService.prototype.transaction = function (fn) {
    return db.transaction((tx) => fn(tx));
  };
  app = await NestFactory.create(AppModule, { logger: false, rawBody:true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: false,
    }),
  );
  const filter = new HttpErrorFilter();
  app.useGlobalFilters({
    catch(e, host) {
      if (!e.getStatus) console.error("TEST_ERROR", e.message);
      filter.catch(e, host);
    },
  });
  app.setGlobalPrefix("api/v1");
  await app.listen(0, "127.0.0.1");
  url = (await app.getUrl()) + "/api/v1";
  provider=app.get((await import("../dist/modules/blockchain/tron.provider.js")).TronBlockchainProvider);
  deposits=app.get((await import("../dist/modules/deposits/deposits.service.js")).DepositsService);
  const reg=await post("/auth/register",{fullName:"Phase Four",email:"four@example.com",mobile:"+919876543218",password,termsAccepted:true},{auth:null});
  const login=await post("/auth/verify-otp",{challengeId:reg.data.challengeId,code:reg.data.developmentOtp,deviceId:"phase4-test"},{auth:null});
  token=login.data.accessToken;uid=(await call("/users/me")).data.id;
  if(!uid)uid=(await db.query("SELECT id FROM users")).rows[0].id;
  assert.equal((await call('/verification/status')).data.status,'REQUIRED');
  const b=await post("/bank-accounts",{accountHolderName:"Phase Four",accountNumber:"123456789012",ifsc:"HDFC0001234",bankName:"HDFC Bank"},{key:randomUUID()});bank=b.data;
  assert.equal(b.status,201,JSON.stringify(b.data));
const c=app.get((await import('../dist/common/crypto.service.js')).CryptoService);aid=randomUUID();admin=c.token();await db.query("INSERT INTO admin_users(id,email_lookup_hash,email_ciphertext,password_hash,status) VALUES($1,$2,$3,$4,'active')",[aid,c.digest('manual@example.com','email'),c.encrypt('manual@example.com','admin-email:'+aid),await c.password(password)]);await db.query("INSERT INTO admin_sessions(admin_user_id,family_id,refresh_token_hash,device_id_hash,expires_at) VALUES($1,$2,$3,'manual-test',now()+interval '15 minutes')",[aid,randomUUID(),c.digest(admin,'admin-session')]);
payoutService=app.get((await import('../dist/modules/payouts/payouts.service.js')).PayoutsService);payoutProvider=app.get((await import('../dist/modules/payouts/payout.provider.js')).PayoutProvider);
});
after(async () => {
  await app?.close();
  await db?.close();
});
async function freshQuote(amount='100',extra={}){await db.query('DELETE FROM rate_limit_buckets');const r=await post('/sell/quote',{amountUsdt:amount,...extra},{key:randomUUID()});assert.equal(r.status,201,JSON.stringify(r.data));return r.data;}
async function order(amount='100',extra={}){const q=await freshQuote(amount,extra);const r=await post('/sell/orders',{quoteId:q.quoteId,bankAccountId:bank.id},{key:randomUUID()});assert.equal(r.status,201,JSON.stringify(r.data));return r.data;}
function transfer(o,changes={}){const hash=randomBytes(32).toString('hex');const t={network:'tron-mock',txHash:hash,eventIndex:0,contract:'DT-MOCK-USDT-CONTRACT',sender:'DT-MOCK-TRON-'+('a'.repeat(40)),receiver:o.depositAddress,rawAmount:'100000000',decimals:6,blockNumber:'1000',blockHash:'b'.repeat(64),timestamp:new Date().toISOString(),execution:'SUCCESS',...changes};provider.transactions.set(hash,{txHash:hash,transfers:[t],canonical:true,execution:'SUCCESS'});return hash;}

let payoutService,payoutProvider;

async function funded(){await db.query("UPDATE risk_flags SET state='resolved',resolved_at=now()");const o=await order();const hash=transfer(o);provider.head=1002n;await deposits.inspect(hash);return o;}
async function payout(){const o=await funded();const id=await payoutService.create(o.orderId);return {o,id};}
async function submitted(){const p=await payout();await payoutService.submit(p.id);return p;}
async function evidence(id,status='SUCCESS') {const a=(await db.query('SELECT * FROM payout_attempts WHERE payout_id=$1 ORDER BY attempt_number DESC LIMIT 1',[id])).rows[0];await db.query("UPDATE sandbox_payout_records SET status=$2,utr=CASE WHEN $2 IN ('SUCCESS','REVERSED') THEN 'SANDBOX-UTR-'||substr(provider_ref,9,12) ELSE NULL END,failure_code=CASE WHEN $2='FAILED' THEN 'BENEFICIARY_REJECTED' ELSE NULL END WHERE request_key=$1",[a.provider_request_key,status]);return payoutProvider.getPayoutStatus(a.provider_request_key);}
async function webhook(result,eventId=randomUUID(),bad=false,timestamp=String(Math.floor(Date.now()/1000))){const raw=JSON.stringify({eventId,result});const sig=createHmac('sha256',process.env.PAYOUT_WEBHOOK_SECRET).update(timestamp+'.'+raw).digest('hex');const r=await fetch(url+'/webhooks/payout/mock',{method:'POST',headers:{'content-type':'application/json','x-payout-timestamp':timestamp,'x-payout-signature':bad?'0'.repeat(64):sig},body:raw});return {status:r.status,data:await r.json()};}



let admin,aid,proof,receipt,oid,pid,utr,paidAt;


async function upload(auth,purpose='proof'){const form=new FormData();form.set('purpose',purpose);form.set('file',new Blob([Buffer.from('%PDF-1.4\nTEST PRIVATE RECEIPT')],{type:'application/pdf'}),'proof.pdf');const r=await fetch(url+(auth===admin?'/admin/manual':'/manual')+'/files',{method:'POST',headers:{authorization:'Bearer '+auth},body:form});return {status:r.status,data:await r.json()};}
let txHash=randomBytes(32).toString('hex');
test('manual support-only/no-role admin cannot approve or view payout details',async()=>{assert.equal((await call('/admin/manual/payouts',{auth:admin})).status,403);assert.equal((await post('/admin/manual/deposits/'+randomUUID()+'/review',{action:'approve',note:'Unauthorized request'},{auth:admin})).status,403);await db.query("INSERT INTO admin_user_roles(admin_user_id,role_id) SELECT $1,id FROM admin_roles WHERE name='manual-financial-admin'",[aid]);});
test('private proof upload validates type and owner access',async()=>{const f=await upload(token);assert.equal(f.status,201,JSON.stringify(f.data));proof=f.data.id;assert.equal((await call('/manual/files/'+proof)).status,200);assert.equal((await call('/manual/files/'+proof,{auth:null})).status,401);const s=app.get((await import('../dist/modules/manual/manual.service.js')).ManualService);await assert.rejects(s.file(randomUUID(),false,proof));await assert.rejects(s.upload(uid,false,{buffer:Buffer.from('<script>bad</script>'),mimetype:'image/png'},'proof'));});
test('deposit proof is required before recording evidence',async()=>{
 const r=await post('/manual/deposits',{amountUsdt:'100',network:'TRC20',txHash:randomBytes(32).toString('hex')},{key:randomUUID()});
 assert.equal(r.status,400);assert.match(JSON.stringify(r.data),/Attach your deposit proof/);
});
test('manual intake flag allows evidence only and retains pause and financial execution gates',async()=>{
 const keys=['TRANSACTIONS_ENABLED','MANUAL_DEPOSIT_SUBMISSIONS_ENABLED'];const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try {
  process.env.TRANSACTIONS_ENABLED='false';process.env.MANUAL_DEPOSIT_SUBMISSIONS_ENABLED='true';
  const service=app.get((await import('../dist/modules/manual/manual.service.js')).ManualService);
  assert.equal((await call('/manual/configuration')).data.depositsEnabled,true);
  const journals=(await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n;
  const body={amountUsdt:'100',network:'TRC20',txHash:randomBytes(32).toString('hex'),proofId:proof};const key=randomUUID();
  const r=await post('/manual/deposits',body,{key});assert.equal(r.status,201,JSON.stringify(r.data));assert.equal(r.data.status,'UNDER_REVIEW');
  assert.equal((await post('/manual/deposits',body,{key})).data.id,r.data.id);
  assert.equal((await post('/manual/deposits',body,{key:randomUUID()})).status,409);
  assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n,journals);
  await assert.rejects(service.gate(db,'deposits'));
  await db.query("UPDATE system_settings SET value=jsonb_set(value,'{deposits}','false') WHERE key='operational_controls'");
  assert.equal((await call('/manual/configuration')).data.depositsEnabled,false);
  await assert.rejects(service.gate(db,'deposits',uid,true));
  await db.query("UPDATE manual_deposit_requests SET status='REJECTED' WHERE id=$1",[r.data.id]);
 } finally {
  for(const k of keys)if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];
  await db.query("UPDATE system_settings SET value=jsonb_set(value,'{deposits}','true') WHERE key='operational_controls'");
 }
});
let deposit;
test('proof submission records review without credit and rejects duplicate hash',async()=>{const b={amountUsdt:'100',network:'TRC20',txHash,proofId:proof,note:'My deposit proof'};const r=await post('/manual/deposits',b,{key:randomUUID()});assert.equal(r.status,201,JSON.stringify(r.data));deposit=r.data.id;assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n,0);assert.equal((await post('/manual/deposits',b,{key:randomUUID()})).status,409);});
test('manual approval requires start review and complete blockchain evidence',async()=>{const base={action:'approve',note:'Verified transfer against explorer'};assert.equal((await post('/admin/manual/deposits/'+deposit+'/review',base,{auth:admin})).status,409);assert.equal((await post('/admin/manual/deposits/'+deposit+'/review',{action:'start',note:'Starting blockchain review'},{auth:admin})).status,201);assert.equal((await post('/admin/manual/deposits/'+deposit+'/review',base,{auth:admin})).status,400);});
const approval=()=>({action:'approve',note:'Verified hash, token, recipient, amount and confirmations',verifiedAmount:'100',txHash,receiver:'DT-MOCK-COLLECTION',contract:'DT-MOCK-USDT-CONTRACT',sender:'DT-MOCK-SENDER',blockNumber:'1000',blockHash:'b'.repeat(64),confirmations:3,transactionTime:new Date().toISOString(),chainSucceeded:true});
test('approved manual deposit credits once with balanced ledger and history',async()=>{const r=await post('/admin/manual/deposits/'+deposit+'/review',approval(),{auth:admin});assert.equal(r.status,201,JSON.stringify(r.data));assert.equal(r.data.status,'CREDITED');assert.equal((await post('/admin/manual/deposits/'+deposit+'/review',approval(),{auth:admin})).status,201);assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals WHERE event_key=$1',['deposit:tron-mock:'+txHash])).rows[0].n,1);assert.equal((await db.query('SELECT * FROM ledger_integrity_issues')).rows.length,0);assert.equal((await call('/manual/deposits/'+deposit)).data.timeline.at(-1).to_status,'CREDITED');});
test('manual rejection and information requests do not credit',async()=>{const r=await post('/manual/deposits',{amountUsdt:'100',network:'TRC20',txHash:randomBytes(32).toString('hex'),proofId:proof},{key:randomUUID()});assert.equal((await post('/admin/manual/deposits/'+r.data.id+'/review',{action:'reject',note:'Transaction Not Found on configured network'},{auth:admin})).status,201);assert.equal((await call('/manual/deposits/'+r.data.id)).data.status,'REJECTED');});
test('manual sell consumes only approved ledger balance and locks quote values',async()=>{const q=await freshQuote('100');assert.equal(q.fundingSource,'wallet');const r=await post('/sell/orders',{quoteId:q.quoteId,bankAccountId:bank.id},{key:randomUUID()});assert.equal(r.status,201,JSON.stringify(r.data));oid=r.data.orderId;assert.equal(r.data.status,'READY_FOR_PAYOUT');const q2=await freshQuote('100');assert.equal((await post('/sell/orders',{quoteId:q2.quoteId,bankAccountId:bank.id},{key:randomUUID()})).status,409);});
test('manual payout process reveals bank only with permission and audit',async()=>{const r=await post('/admin/manual/payouts/'+oid+'/process',{note:'Preparing business bank transfer'},{auth:admin});assert.equal(r.status,201,JSON.stringify(r.data));pid=r.data.payoutId;assert.equal(r.data.bank.accountNumber,'123456789012');assert.ok((await db.query("SELECT id FROM audit_logs WHERE action='manual.bank_reveal'")).rows.length);assert.ok(!JSON.stringify((await call('/admin/manual/payouts',{auth:admin})).data).includes('123456789012'));});
test('manual payout requires exact amount UTR and private receipt',async()=>{const r=await post('/admin/manual/payouts/'+oid+'/confirm',{amountInr:'1',paidAt:new Date().toISOString(),bankUsed:'Business bank',note:'Recorded bank payment'},{auth:admin});assert.equal(r.status,400);const f=await upload(admin,'receipt');assert.equal(f.status,201,JSON.stringify(f.data));receipt=f.data.id;const s=app.get((await import('../dist/modules/manual/manual.service.js')).ManualService);await assert.rejects(s.file(uid,false,receipt));});
let confirmBody;
test('manual confirmation settles INR atomically and duplicate confirmation is safe',async()=>{const p=(await db.query('SELECT amount_inr_minor FROM payouts WHERE id=$1',[pid])).rows[0];const n=BigInt(p.amount_inr_minor);utr='TEST-BANK-'+randomBytes(8).toString('hex');paidAt=new Date().toISOString();confirmBody={amountInr:(n/100n)+'.'+String(n%100n).padStart(2,'0'),utr,paidAt,bankUsed:'Business Bank Test',note:'Payment receipt and UTR verified',receiptId:receipt,bankTransferConfirmed:true};const results=await Promise.all([post('/admin/manual/payouts/'+oid+'/confirm',confirmBody,{auth:admin}),post('/admin/manual/payouts/'+oid+'/confirm',confirmBody,{auth:admin})]);assert.ok(results.every(x=>x.status===201));const r=results[0];assert.equal(r.status,201,JSON.stringify(r.data));assert.equal((await post('/admin/manual/payouts/'+oid+'/confirm',confirmBody,{auth:admin})).data.duplicate,true);assert.equal((await call('/sell/orders/'+oid)).data.status,'COMPLETED');assert.equal((await call('/manual/files/'+receipt)).status,200);assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals WHERE event_key=$1',['payout:'+pid])).rows[0].n,1);assert.equal((await db.query('SELECT * FROM ledger_integrity_issues')).rows.length,0);});
test('automatic provider execution remains disabled in manual mode',async()=>{await assert.rejects(payoutService.create(oid));await assert.rejects(payoutService.submit(pid));await deposits.inspect('c'.repeat(64));});
test('android metadata starts unavailable and cannot accept unsigned/third-party APK',async()=>{assert.equal((await call('/app/version/android',{auth:null})).data.available,false);assert.equal((await post('/admin/manual/releases',{},{auth:admin})).status,403);await db.query("INSERT INTO admin_user_roles(admin_user_id,role_id) SELECT $1,id FROM admin_roles WHERE name='android-release-publisher'",[aid]);assert.equal((await post('/admin/manual/releases',{},{auth:admin})).status,400);const {officialUrl}=await import('../dist/modules/manual/android.service.js');process.env.APK_ALLOWED_ORIGINS='https://dtexchange.example';assert.equal(officialUrl('https://evil.example/DTExchange.apk'),false);assert.equal(officialUrl('http://dtexchange.example/DTExchange.apk'),false);});
test('signed android attestation publishes approved metadata and enforces minimum client version',async()=>{const {sign}=await import('node:crypto'),pair=generateKeyPairSync('ed25519'),{releasePayload}=await import('../dist/modules/manual/android.service.js');process.env.APK_RELEASE_PUBLIC_KEY_B64=Buffer.from(pair.publicKey.export({type:'spki',format:'pem'})).toString('base64');const b={versionName:'1.0.1',versionCode:8002,minimumVersionCode:8002,apkUrl:'https://dtexchange.example/downloads/DTExchange.apk',downloadUrl:'https://dtexchange.example/download',sha256:'a'.repeat(64),certificateSha256:'b'.repeat(64),sizeBytes:100,releaseNotes:'Fixture only; not a real APK.',mandatory:true};const signature=sign(null,Buffer.from(releasePayload(b)),pair.privateKey).toString('base64');const r=await post('/admin/manual/releases',{...b,signature},{auth:admin});assert.equal(r.status,201,JSON.stringify(r.data));const v=await call('/app/version/android',{auth:null});assert.equal(v.data.minimumVersionCode,8002);process.env.ANDROID_UPDATE_ENFORCED='true';try{assert.equal((await post('/sell/quote',{amountUsdt:'10'},{key:randomUUID()})).status,403);}finally{delete process.env.ANDROID_UPDATE_ENFORCED;}});
test('manual configuration rejects concurrent automatic credit or payout switches',async()=>{const {assertManualMode}=await import('../dist/config/manual-mode.js');assert.throws(()=>assertManualMode({MANUAL_DEPOSIT_REVIEW:'true',AUTOMATED_BLOCKCHAIN_CREDIT:'true'}));assert.throws(()=>assertManualMode({MANUAL_PAYOUT:'true',AUTOMATED_PAYOUT:'true'}));assert.doesNotThrow(()=>assertManualMode({MANUAL_DEPOSIT_REVIEW:'true',MANUAL_PAYOUT:'true',AUTOMATED_BLOCKCHAIN_CREDIT:'false',AUTOMATED_PAYOUT:'false'}));});
test('concurrent manual approvals post one credit; amount mismatch remains uncredited',async()=>{process.env.ANDROID_UPDATE_ENFORCED='false';const hash=randomBytes(32).toString('hex');const r=await post('/manual/deposits',{amountUsdt:'100',network:'TRC20',txHash:hash,proofId:proof},{key:randomUUID()});assert.equal(r.status,201);await post('/admin/manual/deposits/'+r.data.id+'/review',{action:'start',note:'Independent chain review started'},{auth:admin});const b={...approval(),txHash:hash,verifiedAmount:'101'};assert.equal((await post('/admin/manual/deposits/'+r.data.id+'/review',b,{auth:admin})).status,400);b.verifiedAmount='100';const result=await Promise.all([post('/admin/manual/deposits/'+r.data.id+'/review',b,{auth:admin}),post('/admin/manual/deposits/'+r.data.id+'/review',b,{auth:admin})]);assert.ok(result.every(r=>r.status===201));assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals WHERE event_key=$1',['deposit:tron-mock:'+hash])).rows[0].n,1);assert.equal((await db.query('SELECT * FROM ledger_integrity_issues')).rows.length,0);});
test('private release evidence and credited deposit history cannot be rewritten',async()=>{await assert.rejects(db.query("UPDATE android_releases SET sha256=$1",['b'.repeat(64)]));await assert.rejects(db.query("UPDATE manual_deposit_requests SET verified_amount=999 WHERE id=$1",[deposit]));await assert.rejects(db.query('DELETE FROM manual_action_history WHERE entity_id=$1',[deposit]));});
test('manual website release gate excludes stores and automation without waiving infrastructure',async()=>{const {certify}=await import('../../scripts/release-gate.mjs');const r=certify({operatingModel:'MANUAL_ANDROID',areas:{},findings:[]});assert.equal(r.status,'BLOCKED_FOR_PRODUCTION');assert.ok(r.blockers.some(x=>x.startsWith('postgres:')));assert.ok(r.blockers.some(x=>x.startsWith('manualDeposits:')));assert.ok(!r.blockers.some(x=>x.startsWith('ios:')||x.startsWith('blockchain:')||x.startsWith('payout:')||x.startsWith('financial providers:')));});

test('manual production checklist retains secrets and infrastructure while excluding automatic provider credentials',async()=>{const {setupReport}=await import('../dist/config/setup-report.js');const r=setupReport({MANUAL_DEPOSIT_REVIEW:'true',MANUAL_PAYOUT:'true',AUTOMATED_BLOCKCHAIN_CREDIT:'false',AUTOMATED_PAYOUT:'false'});assert.equal(r.AUTOMATED_PAYOUT,'configured');assert.equal(r.DATABASE_URL,'missing');assert.equal(r.MANUAL_COLLECTION_ADDRESS,'missing');assert.equal(r.PAYOUT_API_KEY,undefined);assert.equal(r.TRON_API_KEY,undefined);assert.equal(r.CUSTODY_API_URL,undefined);});

test('full ledger audit includes manual credits and payment evidence with zero issues',async()=>{const sql=await readFile(new URL('../operations/ledger-integrity.sql',import.meta.url),'utf8');const results=await db.exec(sql);assert.deepEqual(results.flatMap(r=>r.rows),[]);});

test('manual lifecycle never fabricates identity approval and keeps account restrictions',async()=>{
  assert.equal((await call('/verification/status')).data.status,'REQUIRED');
  assert.equal((await db.query("SELECT count(*)::int n FROM verification_records WHERE user_id=$1 AND type<>'bank'",[uid])).rows[0].n,0);
  const service=app.get((await import('../dist/modules/manual/manual.service.js')).ManualService);
  await db.query("UPDATE users SET status='frozen' WHERE id=$1",[uid]);
  try { await assert.rejects(service.eligible({query:(s,p)=>db.query(s,p)},uid)); } finally {await db.query("UPDATE users SET status='active' WHERE id=$1",[uid]);}
  await service.eligible({query:(s,p)=>db.query(s,p)},uid);
});
test('operations dashboard and users expose operational data without identity status',async()=>{
  const service=app.get((await import('../dist/common/operations.service.js')).OperationsService);
  await assert.rejects(service.list(aid,'users'));
  await db.query("INSERT INTO admin_role_permissions(role_id,permission_code) SELECT id,unnest(ARRAY['users.read','dashboard.read']) FROM admin_roles WHERE name='manual-financial-admin' ON CONFLICT DO NOTHING");
  const users=await service.list(aid,'users');
  const user=users.find(x=>x.id===uid);assert.equal(user.email,'four@example.com');assert.equal(user.verification_status,undefined);assert.ok('bank_accounts' in user);assert.ok('last_login' in user);
  const [stats]=await service.list(aid,'dashboard');assert.ok('active_users' in stats);assert.ok('pending_deposits' in stats);assert.ok('completed_payouts' in stats);assert.equal(stats.verified_users,undefined);assert.equal(stats.pending_reviews,undefined);
});

test('manual eligibility preserves risk gates and automatic mode identity checks',async()=>{
  const service=app.get((await import('../dist/modules/manual/manual.service.js')).ManualService);
  const risk=(await db.query("INSERT INTO risk_flags(user_id,code,severity) VALUES($1,'IDENTITY_UI_REGRESSION','high') RETURNING id",[uid])).rows[0];
  try {
    await assert.rejects(service.eligible({query:(s,p)=>db.query(s,p)},uid));
    assert.equal((await post('/sell/quote',{amountUsdt:'10'},{key:randomUUID()})).status,403);
  } finally {await db.query("UPDATE risk_flags SET state='resolved',resolved_at=now() WHERE id=$1",[risk.id]);}
  process.env.MANUAL_DEPOSIT_REVIEW='false';process.env.MANUAL_PAYOUT='false';
  try {assert.equal((await post('/sell/quote',{amountUsdt:'10'},{key:randomUUID()})).status,403);}
  finally {process.env.MANUAL_DEPOSIT_REVIEW='true';process.env.MANUAL_PAYOUT='true';}
  assert.equal((await call('/verification/status')).data.status,'REQUIRED');
});

test('deposit minimum and daily reservations enforce exact boundaries without ledger writes',async()=>{
 const send=amountUsdt=>post('/manual/deposits',{amountUsdt,network:'TRC20',txHash:randomBytes(32).toString('hex'),proofId:proof},{key:randomUUID()});
 const low=await send('99');assert.equal(low.status,400);assert.match(JSON.stringify(low.data),/Minimum deposit is 100 USDT/);
 const used=(await db.query("SELECT coalesce(sum(coalesce(net_credited_amount,verified_amount,submitted_amount)),0)::text n FROM manual_deposit_requests WHERE user_id=$1 AND status NOT IN ('REJECTED','CANCELLED')",[uid])).rows[0].n;
 const remaining=20000000000n-decimal(used,6);const amountText=(remaining/1000000n).toString();
 const results=await Promise.all([send(amountText),send(amountText)]);assert.deepEqual(results.map(r=>r.status).sort(),[201,400]);
 assert.equal((await send('100')).status,400);
 const credited=(await db.query("SELECT * FROM manual_deposit_requests WHERE id=$1",[deposit])).rows[0];assert.equal(credited.net_credited_amount,credited.verified_amount);assert.equal(credited.policy_snapshot.minimumDeposit,'100');
});

test('monthly deposits are uncapped; earlier days do not consume today while resubmission reserves again',async()=>{
 await db.query("UPDATE manual_deposit_requests SET status='REJECTED' WHERE user_id=$1 AND status IN ('PROOF_SUBMITTED','UNDER_REVIEW')",[uid]);
 const config=(await call('/manual/configuration')).data;assert.equal(config.monthlyDepositLimit,null);assert.equal(config.monthlyDepositLimitEnabled,false);
 const r=await post('/manual/deposits',{amountUsdt:'19000',network:'TRC20',txHash:randomBytes(32).toString('hex'),proofId:proof},{key:randomUUID()});assert.equal(r.status,201);
 await db.query("UPDATE manual_deposit_requests SET limit_day=limit_day-1 WHERE id=$1",[r.data.id]);
 const next=await post('/manual/deposits',{amountUsdt:'19000',network:'TRC20',txHash:randomBytes(32).toString('hex'),proofId:proof},{key:randomUUID()});assert.equal(next.status,201);
 const rejected=(await db.query("SELECT id FROM manual_deposit_requests WHERE user_id=$1 AND status='REJECTED' AND submitted_amount>1000 LIMIT 1",[uid])).rows[0];
 assert.equal((await post('/manual/deposits/'+rejected.id+'/resubmit',{proofId:proof,note:'Updated private deposit proof'})).status,400);
});

test('authenticated manual rate contract returns production-shaped 103 with zero fee and approved sell limits',async()=>{
 const fee=(await db.query("INSERT INTO fees(version,flat_inr_minor,basis_points,effective_from) SELECT max(version)+1,0,0,now() FROM fees RETURNING id")).rows[0];
 await db.query("INSERT INTO rate_policies(version,mode,manual_rate,margin_bps,spread_bps,minimum_sell,maximum_sell,daily_limit,monthly_limit,quote_expiry_seconds,maximum_rate_age_seconds,fee_id,effective_from) SELECT max(version)+1,'manual',103,0,0,100,5000,20000,100000,60,120,$1,now() FROM rate_policies",[fee.id]);
 assert.equal((await call('/rates/usdt-inr',{auth:null})).status,401);
 const r=await call('/rates/usdt-inr');assert.equal(r.status,200);assert.equal(r.data.exchangeRate,'103.00000000');assert.equal(r.data.source,'MANUAL_ADMIN');assert.equal(r.data.sandbox,false);assert.equal(r.data.quotesConfigured,true);
 assert.equal(decimal(r.data.maximumSell,18),5000n*10n**18n);assert.equal(r.data.feeBasisPoints,0);assert.equal(r.data.fixedFeeInrMinor,'0');
 assert.ok(Date.parse(r.data.validUntil)-Date.parse(r.data.timestamp)>=59900);
 assert.ok(Date.parse(r.data.validUntil)-Date.parse(r.data.timestamp)<=60100);
});


test('scoped physical validation permits only synthetic review and non-payable quotes',async()=>{
 const prior={transactions:process.env.TRANSACTIONS_ENABLED,payouts:process.env.PAYOUTS_ENABLED};
 process.env.TRANSACTIONS_ENABLED='false';process.env.PAYOUTS_ENABLED='false';
 try {
  assert.equal((await call('/manual/configuration')).data.depositsEnabled,false);
  await db.query("INSERT INTO system_settings(key,value) VALUES('synthetic_device_validation',$1)",[JSON.stringify({userId:uid,enabled:true,expiresAt:new Date(Date.now()+600000).toISOString()})]);
  assert.equal((await call('/manual/configuration')).data.depositsEnabled,true);
  await db.query("UPDATE system_settings SET value=jsonb_set(value,'{userId}',to_jsonb($1::text)) WHERE key='synthetic_device_validation'",[randomUUID()]);
  assert.equal((await call('/manual/configuration')).data.depositsEnabled,false);
  await db.query("UPDATE system_settings SET value=jsonb_set(value,'{userId}',to_jsonb($1::text)) WHERE key='synthetic_device_validation'",[uid]);
  await db.query("UPDATE manual_deposit_requests SET status='REJECTED' WHERE user_id=$1 AND status IN ('PROOF_SUBMITTED','UNDER_REVIEW')",[uid]);
  const body={amountUsdt:'100',network:'TRC20',txHash:randomBytes(32).toString('hex'),proofId:proof};
  const r=await post('/manual/deposits',body,{key:randomUUID()});assert.equal(r.status,201,JSON.stringify(r.data));assert.equal(r.data.status,'UNDER_REVIEW');assert.equal(r.data.policy_snapshot.synthetic,true);
  assert.equal((await post('/manual/deposits',body,{key:randomUUID()})).status,409);
  await assert.rejects(db.query("UPDATE manual_deposit_requests SET status='CREDITED' WHERE id=$1",[r.data.id]),/Synthetic deposit/);
  await assert.rejects(db.query("UPDATE manual_deposit_requests SET policy_snapshot='{}' WHERE id=$1",[r.data.id]),/permanent/);
  const b=await post('/bank-accounts',{accountHolderName:'TEST SYNTHETIC',accountNumber:'000000000000',ifsc:'TEST0000000',bankName:'TEST SYNTHETIC NON-PAYOUT'},{key:randomUUID()});assert.equal(b.status,201,JSON.stringify(b.data));assert.equal(b.data.verificationStatus,'UNDER_REVIEW');
  await assert.rejects(db.query("UPDATE bank_accounts SET verification_status='verified' WHERE id=$1",[b.data.id]),/Synthetic bank/);
  const q=await post('/sell/quote',{amountUsdt:'100',bankAccountId:b.data.id},{key:randomUUID()});assert.equal(q.status,201,JSON.stringify(q.data));assert.equal(q.data.executionEnabled,false);assert.equal(q.data.finalInrMinor,'1030000');
  assert.equal((await post('/sell/quote',{amountUsdt:'5001',bankAccountId:b.data.id},{key:randomUUID()})).status,400);
  assert.notEqual((await post('/sell/orders',{quoteId:q.data.quoteId,bankAccountId:b.data.id},{key:randomUUID()})).status,201);
  await db.query("UPDATE system_settings SET value=jsonb_set(value,'{expiresAt}',to_jsonb('2000-01-01T00:00:00Z'::text)) WHERE key='synthetic_device_validation'");
  assert.equal((await call('/manual/configuration')).data.depositsEnabled,false);
  assert.equal((await post('/sell/quote',{amountUsdt:'100',bankAccountId:b.data.id},{key:randomUUID()})).status,400);
 } finally {process.env.TRANSACTIONS_ENABLED=prior.transactions;process.env.PAYOUTS_ENABLED=prior.payouts;await db.query("DELETE FROM system_settings WHERE key='synthetic_device_validation'");}
});


test('unpublished approved build permits scoped test writes only, never orders or other builds',async()=>{
 const prior={transactions:process.env.TRANSACTIONS_ENABLED,payouts:process.env.PAYOUTS_ENABLED,updates:process.env.ANDROID_UPDATE_ENFORCED};
 process.env.TRANSACTIONS_ENABLED='false';process.env.PAYOUTS_ENABLED='false';process.env.ANDROID_UPDATE_ENFORCED='true';
 try {
  await db.query("UPDATE android_releases SET active=false WHERE active");
  await db.query("INSERT INTO system_settings(key,value) VALUES('synthetic_device_validation',$1)",[JSON.stringify({userId:uid,enabled:true,androidVersionCode:'8004',expiresAt:new Date(Date.now()+600000).toISOString()})]);
  const body={amountUsdt:'100',network:'TRC20',txHash:randomBytes(32).toString('hex'),proofId:proof};
  const releaseBlocked=await post('/manual/deposits',body,{key:randomUUID(),version:'8003'});
  assert.equal(releaseBlocked.status,403);
  assert.equal(releaseBlocked.data.error.code,'ANDROID_RELEASE_REQUIRED');
  assert.equal((await post('/manual/deposits',body,{key:randomUUID(),version:'8004'})).status,201);
  assert.equal((await post('/sell/orders',{quoteId:randomUUID(),bankAccountId:bank.id},{key:randomUUID(),version:'8004'})).status,403);
  await db.query("UPDATE system_settings SET value=jsonb_set(value,'{userId}',to_jsonb($1::text)) WHERE key='synthetic_device_validation'",[randomUUID()]);
  assert.equal((await post('/manual/deposits',{...body,txHash:randomBytes(32).toString('hex'),proofId:proof},{key:randomUUID(),version:'8004'})).status,403);
 } finally {process.env.TRANSACTIONS_ENABLED=prior.transactions;process.env.PAYOUTS_ENABLED=prior.payouts;if(prior.updates===undefined)delete process.env.ANDROID_UPDATE_ENFORCED;else process.env.ANDROID_UPDATE_ENFORCED=prior.updates;await db.query("DELETE FROM system_settings WHERE key='synthetic_device_validation'");}
});


test('existing operations admin plus manual-deposit-approver is deposit-only and audited',async()=>{
 await db.query('DELETE FROM admin_user_roles WHERE admin_user_id=$1',[aid]);
 await db.query("INSERT INTO admin_user_roles(admin_user_id,role_id) SELECT $1,id FROM admin_roles WHERE name IN ('operations','manual-deposit-approver')",[aid]);
 const permissions=(await db.query("SELECT p.permission_code FROM admin_role_permissions p JOIN admin_roles r ON r.id=p.role_id WHERE r.name='manual-deposit-approver' ORDER BY p.permission_code")).rows.map(r=>r.permission_code);
 assert.deepEqual(permissions,['DEPOSIT_APPROVE','DEPOSIT_REVIEW']);
 assert.equal((await call('/admin/manual/deposits',{auth:admin})).status,200);
 assert.equal((await call('/admin/manual/files/'+proof,{auth:admin})).status,200);
 assert.equal((await call('/admin/manual/files/'+proof,{auth:null})).status,401);
 assert.equal((await call('/admin/manual/files/'+receipt,{auth:admin})).status,403);
 assert.equal((await call('/admin/manual/payouts',{auth:admin})).status,403);
 assert.equal((await call('/admin/manual/deposit-wallet',{auth:admin})).status,403);
 const service=app.get((await import('../dist/modules/manual/manual.service.js')).ManualService);
 for(const permission of ['PAYOUT_VIEW','PAYOUT_PROCESS','PAYOUT_CONFIRM','FINANCIAL_ADMIN','settings.write','roles.write','ledger.write']) await assert.rejects(service.permission(aid,permission));
 const synthetic=(await db.query("SELECT id FROM manual_deposit_requests WHERE user_id=$1 AND policy_snapshot->>'synthetic'='true' AND status='UNDER_REVIEW' LIMIT 1",[uid])).rows[0];assert.ok(synthetic);
 const before=(await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n;
 assert.equal((await post('/admin/manual/deposits/'+synthetic.id+'/review',{action:'approve',note:'TEST synthetic must never receive credit'},{auth:admin})).status,403);
 assert.equal((await post('/admin/manual/deposits/'+synthetic.id+'/review',{action:'reject',note:'TEST synthetic evidence rejected; no funds involved'},{auth:admin})).status,201);
 assert.equal((await db.query("SELECT count(*)::int n FROM audit_logs WHERE actor_id=$1 AND entity_id=$2 AND action='manual.transition' AND sanitized_changes->>'to'='REJECTED'",[aid,synthetic.id])).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n,before);
 const h=randomBytes(32).toString('hex');const body={amountUsdt:'100',network:'TRC20',txHash:h,proofId:proof};const r=await post('/manual/deposits',body,{key:randomUUID()});assert.equal(r.status,201);
 assert.equal((await post('/manual/deposits',body,{key:randomUUID()})).status,409);
 assert.equal((await post('/admin/manual/deposits/'+r.data.id+'/review',{action:'start',note:'Isolated test blockchain evidence review'},{auth:admin})).status,201);
 assert.equal((await post('/admin/manual/deposits/'+r.data.id+'/review',{action:'approve',note:'Incomplete evidence must not credit'},{auth:admin})).status,400);
 const ok=await post('/admin/manual/deposits/'+r.data.id+'/review',{...approval(),txHash:h},{auth:admin});assert.equal(ok.status,201,JSON.stringify(ok.data));assert.equal(ok.data.status,'CREDITED');
 assert.equal((await db.query('SELECT count(*)::int n FROM ledger_integrity_issues')).rows[0].n,0);
});

test('dedicated Android publisher grants no financial capabilities and rejects tampered attestations',async()=>{
 const prior=(await db.query('SELECT role_id FROM admin_user_roles WHERE admin_user_id=$1',[aid])).rows;
 await db.query('DELETE FROM admin_user_roles WHERE admin_user_id=$1',[aid]);
 try {
 await db.query("INSERT INTO admin_user_roles(admin_user_id,role_id) SELECT $1,id FROM admin_roles WHERE name='android-release-publisher'",[aid]);
 const permissions=(await db.query("SELECT p.permission_code FROM admin_role_permissions p JOIN admin_roles r ON r.id=p.role_id WHERE r.name='android-release-publisher'")).rows.map(r=>r.permission_code);
 assert.deepEqual(permissions,['ANDROID_RELEASE_PUBLISH']);
 const svc=app.get((await import('../dist/modules/manual/manual.service.js')).ManualService);
 for(const p of ['FINANCIAL_ADMIN','DEPOSIT_REVIEW','DEPOSIT_APPROVE','PAYOUT_VIEW','PAYOUT_PROCESS','PAYOUT_CONFIRM','ledger.write','reconciliation.resolve','banks.read','users.manage','settings.write','roles.write'])await assert.rejects(svc.permission(aid,p));
 assert.equal((await call('/admin/manual/releases',{auth:admin})).status,200);
 assert.equal((await call('/admin/manual/releases',{auth:null})).status,401);
 for(const p of ['/admin/manual/deposits','/admin/manual/payouts','/admin/manual/deposit-wallet'])assert.equal((await call(p,{auth:admin})).status,403);
 const {sign}=await import('node:crypto'),pair=generateKeyPairSync('ed25519'),{releasePayload}=await import('../dist/modules/manual/android.service.js');
 process.env.APK_RELEASE_PUBLIC_KEY_B64=Buffer.from(pair.publicKey.export({type:'spki',format:'pem'})).toString('base64');
 const b={versionName:'1.0.0',versionCode:8008,minimumVersionCode:8008,apkUrl:'https://dtexchange.example/downloads/DTExchange.apk',downloadUrl:'https://dtexchange.example/download',sha256:'c'.repeat(64),certificateSha256:'d'.repeat(64),sizeBytes:1234,releaseNotes:'Synthetic release metadata only',mandatory:false};
 const signature=sign(null,Buffer.from(releasePayload(b)),pair.privateKey).toString('base64');
 assert.equal((await post('/admin/manual/releases',{...b,sha256:'e'.repeat(64),signature},{auth:admin})).status,400);
 const result=await post('/admin/manual/releases',{...b,signature},{auth:admin});assert.equal(result.status,201,JSON.stringify(result.data));
 assert.equal((await db.query("SELECT count(*)::int n FROM audit_logs WHERE action='android.publish' AND entity_id='8008'")).rows[0].n,1);
 } finally {await db.query('DELETE FROM admin_user_roles WHERE admin_user_id=$1',[aid]);for(const r of prior)await db.query('INSERT INTO admin_user_roles(admin_user_id,role_id) VALUES($1,$2)',[aid,r.role_id]);}
});

test('owner deposit fee/month cap enforce gross limits and retain immutable rate/policy snapshots',async()=>{
 await db.query("INSERT INTO admin_user_roles(admin_user_id,role_id) SELECT $1,id FROM admin_roles WHERE name='OWNER_ADMIN' ON CONFLICT DO NOTHING",[aid]);
 const usage=(await db.query("SELECT coalesce(sum(coalesce(verified_amount,submitted_amount)),0)::text n FROM manual_deposit_requests WHERE user_id=$1 AND status NOT IN ('REJECTED','CANCELLED') AND date_trunc('month',coalesce(limit_day,(created_at AT TIME ZONE 'Asia/Kolkata')::date))=date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata')",[uid])).rows[0].n;
 let current=(await call('/admin/manual/deposit-policy',{auth:admin})).data;
 const update={minimumDeposit:'100',depositFeeUsdt:'1.25',dailyDepositLimit:'100000',monthlyLimitEnabled:true,monthlyDepositLimit:((decimal(usage,6)+150000000n)/1000000n).toString(),version:current.version,reason:'Synthetic isolated fee and monthly-cap validation'};
 const changed=await post('/admin/manual/deposit-policy',update,{auth:admin});assert.equal(changed.status,201,JSON.stringify(changed.data));
 const h=randomBytes(32).toString('hex');const r=await post('/manual/deposits',{amountUsdt:'100',network:'TRC20',txHash:h,proofId:proof},{key:randomUUID()});assert.equal(r.status,201,JSON.stringify(r.data));assert.equal(r.data.policy_snapshot.depositFeeUsdt,'1.25');assert.equal(r.data.rate_snapshot.source,'MANUAL_ADMIN');assert.equal(r.data.rate_snapshot.rateInr,'103.00000000');
 const over=await post('/manual/deposits',{amountUsdt:'100',network:'TRC20',txHash:randomBytes(32).toString('hex'),proofId:proof},{key:randomUUID()});assert.equal(over.status,400);assert.equal((await db.query('SELECT count(*)::int n FROM manual_deposit_requests WHERE tx_hash=$1',[h])).rows[0].n,1);
 await assert.rejects(db.query("UPDATE manual_deposit_requests SET rate_snapshot='{}' WHERE id=$1",[r.data.id]));await assert.rejects(db.query("UPDATE manual_deposit_requests SET policy_snapshot='{}' WHERE id=$1",[r.data.id]));
 current=(await call('/admin/manual/deposit-policy',{auth:admin})).data;
 assert.equal((await post('/admin/manual/deposit-policy',{...update,version:current.version,depositFeeUsdt:'2',monthlyLimitEnabled:false,monthlyDepositLimit:null},{auth:admin})).status,201);
 await post('/admin/manual/deposits/'+r.data.id+'/review',{action:'start',note:'Isolated synthetic chain evidence test'},{auth:admin});
 const approved=await post('/admin/manual/deposits/'+r.data.id+'/review',{...approval(),txHash:h},{auth:admin});assert.equal(approved.status,201,JSON.stringify(approved.data));
 const saved=(await db.query('SELECT * FROM manual_deposit_requests WHERE id=$1',[r.data.id])).rows[0];assert.equal(saved.deposit_fee_amount,'1.250000');assert.equal(saved.net_credited_amount,'98.750000');assert.equal(saved.verified_amount,'100.000000');assert.equal(saved.policy_snapshot.depositFeeUsdt,'1.25');assert.deepEqual(saved.rate_snapshot,r.data.rate_snapshot);assert.equal((await db.query('SELECT * FROM ledger_integrity_issues')).rows.length,0);
 const lines=(await db.query('SELECT e.amount::text,a.bucket,a.kind FROM ledger_entries e JOIN ledger_accounts a ON a.id=e.account_id JOIN ledger_journals j ON j.id=e.journal_id WHERE j.source_id=$1',[r.data.id])).rows;assert.equal(lines.find(l=>l.bucket==='fees').kind,'income');assert.equal(decimal(lines.find(l=>l.bucket==='fees').amount,18),1250000000000000000n);
 current=(await call('/admin/manual/deposit-policy',{auth:admin})).data;assert.equal((await post('/admin/manual/deposit-policy',{...update,version:current.version,depositFeeUsdt:'100'},{auth:admin})).status,400);assert.equal((await post('/admin/manual/deposit-policy',{...update,version:current.version,monthlyLimitEnabled:false,monthlyDepositLimit:'500'},{auth:admin})).status,400);
});

test('manual failure requires explicit no-transfer confirmation and never refunds or executes',async()=>{
 const o=await order('100');const id=o.orderId;assert.ok(id);
 const started=await post('/admin/manual/payouts/'+id+'/process',{note:'Isolated synthetic manual payout only'},{auth:admin});assert.equal(started.status,201,JSON.stringify(started.data));
 const count=(await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n;
 assert.equal((await post('/admin/manual/payouts/'+id+'/fail',{note:'Synthetic no transfer confirmation',confirm:true,noTransferConfirmed:false},{auth:admin})).status,400);
 const b={note:'Synthetic confirmed failed without transfer',confirm:true,noTransferConfirmed:true};const r=await post('/admin/manual/payouts/'+id+'/fail',b,{auth:admin});assert.equal(r.status,201,JSON.stringify(r.data));assert.equal(r.data.liabilityRetained,true);
 assert.equal((await post('/admin/manual/payouts/'+id+'/fail',b,{auth:admin})).data.duplicate,true);assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n,count);
 assert.equal((await db.query('SELECT status FROM sell_orders WHERE id=$1',[id])).rows[0].status,'failed');assert.equal((await post('/admin/manual/payouts/'+oid+'/fail',b,{auth:admin})).status,409);
 assert.ok((await db.query("SELECT 1 FROM audit_logs WHERE entity_id=$1 AND sanitized_changes->>'to'='FAILED'",[id])).rows.length);
});

test('self-declared manual banks are immediately available, never independently verified, and blocked when automatic mode is selected',async()=>{
 const listed=await call('/bank-accounts');assert.equal(listed.status,200);
 const b=listed.data.find(x=>x.id===bank.id);assert.equal(b.available,true);assert.equal(b.independentlyVerified,false);assert.equal(b.verificationStatus,'NOT_STARTED');assert.equal(b.accountStatus,'AVAILABLE');
 const stored=(await db.query('SELECT self_declared,verification_status FROM bank_accounts WHERE id=$1',[bank.id])).rows[0];assert.equal(stored.self_declared,true);assert.equal(stored.verification_status,'not_started');
 assert.equal((await post('/bank-accounts',{accountHolderName:'Test',accountNumber:'bad',ifsc:'invalid',bankName:'Synthetic Bank'},{key:randomUUID()})).status,400);
 process.env.AUTOMATED_PAYOUT='true';try{assert.equal((await call('/bank-accounts')).data.find(x=>x.id===bank.id).available,false);const q=await post('/sell/quote',{amountUsdt:'100',bankAccountId:bank.id,fundingSource:'wallet'},{key:randomUUID()});assert.ok([400,403,503].includes(q.status));}finally{process.env.AUTOMATED_PAYOUT='false';}
});

test('private beta integrates existing auth, synthetic evidence, quotes, private proof and fail-closed expiry',async(t)=>{
 const saved={};for(const k of ['PRIVATE_BETA_MODE','MANUAL_DEPOSIT_SUBMISSIONS_ENABLED','REFERRAL_PROGRAM_PAUSED','TRANSACTIONS_ENABLED','PAYOUTS_ENABLED'])saved[k]=process.env[k];
 const reg=await post('/auth/register',{fullName:'Synthetic Beta Tester',email:'isolated-beta@example.com',mobile:'+919876543219',password,termsAccepted:true},{auth:null});
 assert.equal(reg.status,201);
 const logged=await post('/auth/verify-otp',{challengeId:reg.data.challengeId,code:reg.data.developmentOtp,deviceId:'isolated-beta-test'},{auth:null});assert.equal(logged.status,201);
 const session=logged.data,betaUid=(await call('/users/me',{auth:session.accessToken})).data.id;
 const window={userId:betaUid,enabled:true,androidVersionCode:'8017',startedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()};
 const priorPolicy=(await db.query("SELECT value FROM system_settings WHERE key='manual_deposit_policy'")).rows[0].value;
 const journals=(await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n;
 const balances=JSON.stringify((await db.query('SELECT * FROM ledger_balances ORDER BY account_id')).rows);
 const betaCall=(path,extra={})=>call(path,{auth:session.accessToken,version:'8017',...extra});
 const betaPost=(path,body)=>betaCall(path,{method:'POST',body,key:randomUUID()});
 let betaProof,syntheticBank,request;
 try {
  Object.assign(process.env,{PRIVATE_BETA_MODE:'true',MANUAL_DEPOSIT_SUBMISSIONS_ENABLED:'false',REFERRAL_PROGRAM_PAUSED:'true',TRANSACTIONS_ENABLED:'false',PAYOUTS_ENABLED:'false'});
  await db.query("INSERT INTO system_settings(key,value) VALUES('synthetic_device_validation',$1)",[JSON.stringify(window)]);
  await db.query("UPDATE system_settings SET value=$1 WHERE key='manual_deposit_policy'",[JSON.stringify({minimumDeposit:'100',dailyDepositLimit:'20000',depositFeeUsdt:'0',monthlyLimitEnabled:false,monthlyDepositLimit:null})]);
  await t.test('only the existing test account authenticates; ordinary users, signup and OTP sends are blocked',async()=>{
   assert.equal((await betaCall('/users/me')).status,200);
   assert.equal((await call('/users/me',{version:'8017'})).status,503);
   assert.equal((await betaCall('/users/me',{version:'8016'})).status,503);
   assert.equal((await call('/users/me',{auth:session.accessToken})).status,503);
   const challenges=(await db.query('SELECT count(*)::int n FROM otp_challenges')).rows[0].n;
   assert.equal((await post('/auth/request-otp',{contact:'four@example.com',purpose:'login'},{auth:null})).status,503);
   assert.equal((await post('/auth/register',{fullName:'Blocked Signup',email:'blocked-beta@example.com',mobile:'+919876543217',password,termsAccepted:true},{auth:null})).status,503);
   assert.equal((await db.query('SELECT count(*)::int n FROM otp_challenges')).rows[0].n,challenges);
   const login=await post('/auth/login',{contact:'isolated-beta@example.com',password,deviceId:'isolated-beta-login'},{auth:null});assert.equal(login.status,201);
   assert.equal((await post('/auth/login',{contact:'four@example.com',password,deviceId:'blocked-beta-login'},{auth:null})).status,503);
  });
  await t.test('configuration suppresses the payable address, preserving policy and the authorized owner view',async()=>{
   const c=await betaCall('/manual/configuration');assert.equal(c.status,200);assert.equal(c.data.address,'DT-SYNTHETIC-NONPAYABLE');assert.equal(c.data.sandbox,true);assert.equal(c.data.depositsEnabled,true);
   assert.equal(c.data.minimumDeposit,'100');assert.equal(c.data.dailyDepositLimit,'20000');assert.equal(c.data.depositFeeUsdt,'0');assert.equal(c.data.monthlyDepositLimit,null);
   const owner=await call('/admin/manual/deposit-wallet',{auth:admin});assert.equal(owner.status,200);assert.notEqual(owner.data.address,c.data.address);
   assert.equal((await betaPost('/wallet/deposit-address',{})).status,503);
  });
  await t.test('proof and deposit remain private, duplicate-safe and permanently non-creditable',async()=>{
   const form=new FormData();form.set('purpose','proof');form.set('file',new Blob([Buffer.from('%PDF-1.4\nSYNTHETIC NONPAYMENT BETA TEST')],{type:'application/pdf'}),'synthetic.pdf');
   const upload=await fetch(url+'/manual/files',{method:'POST',headers:{authorization:'Bearer '+session.accessToken,'x-dt-version-code':'8017'},body:form});assert.equal(upload.status,201);betaProof=(await upload.json()).id;
   const body={amountUsdt:'100',network:'TRC20',txHash:randomBytes(32).toString('hex'),proofId:betaProof};
   assert.equal((await betaPost('/manual/deposits',{...body,amountUsdt:'99'})).status,400);
   const response=await betaPost('/manual/deposits',body);assert.equal(response.status,201,JSON.stringify(response.data));request=response.data;
   assert.equal(request.status,'UNDER_REVIEW');assert.equal(request.policy_snapshot.synthetic,true);assert.equal(request.receiver,'DT-SYNTHETIC-NONPAYABLE');
   assert.equal((await betaPost('/manual/deposits',body)).status,409);
   assert.equal((await betaCall('/manual/files/'+betaProof)).status,200);
   assert.equal((await betaCall('/manual/files/'+betaProof,{auth:null})).status,401);
   assert.equal((await post('/admin/manual/deposits/'+request.id+'/review',{action:'approve',note:'Synthetic beta credit must fail'},{auth:admin})).status,403);
   await assert.rejects(db.query("UPDATE manual_deposit_requests SET status='CREDITED' WHERE id=$1",[request.id]));
  });
  await t.test('only permanently non-payable bank fixtures can quote; orders and ledger execution stay blocked',async()=>{
   assert.equal((await betaPost('/bank-accounts',{accountHolderName:'Example',accountNumber:'1234567890',ifsc:'HDFC0001234',bankName:'Example Bank'})).status,400);
   const bankResponse=await betaPost('/bank-accounts',{accountHolderName:'TEST SYNTHETIC',accountNumber:'000000000000',ifsc:'TEST0000000',bankName:'TEST SYNTHETIC NON-PAYOUT'});assert.equal(bankResponse.status,201);syntheticBank=bankResponse.data;
   const quote=await betaPost('/sell/quote',{amountUsdt:'100',bankAccountId:syntheticBank.id});assert.equal(quote.status,201,JSON.stringify(quote.data));assert.equal(quote.data.executionEnabled,false);assert.equal(quote.data.finalInrMinor,'1030000');assert.equal(quote.data.feeInrMinor,'0');
   assert.ok(Math.abs(Date.parse(quote.data.expiresAt)-Date.parse(quote.data.createdAt)-60000)<2000);
   assert.equal((await betaPost('/sell/quote',{amountUsdt:'5001',bankAccountId:syntheticBank.id})).status,400);
   assert.equal((await betaPost('/sell/orders',{quoteId:quote.data.quoteId,bankAccountId:syntheticBank.id})).status,503);
   assert.equal((await call('/admin/manual/deposits',{auth:admin})).status,200);
   const ledger=app.get((await import('../dist/modules/ledger/ledger.service.js')).LedgerService);
   await assert.rejects(db.transaction(tx=>ledger.post(tx,'beta-forbidden','test',randomUUID(),[])));
  });
  await t.test('revocation closes existing sessions and refresh without ending owner access or restoring ordinary intake',async()=>{
   await db.query("UPDATE system_settings SET value=jsonb_set(value,'{enabled}','false') WHERE key='synthetic_device_validation'");
   assert.equal((await betaCall('/users/me')).status,503);
   assert.equal((await post('/auth/refresh',{refreshToken:session.refreshToken},{auth:null})).status,503);
   assert.equal((await call('/admin/manual/deposits',{auth:admin})).status,200);
   await db.query("UPDATE system_settings SET value=$1 WHERE key='synthetic_device_validation'",[JSON.stringify({...window,startedAt:new Date(Date.now()-120000).toISOString(),expiresAt:new Date(Date.now()-60000).toISOString()})]);
   assert.equal((await betaPost('/manual/deposits',{amountUsdt:'100',network:'TRC20',txHash:randomBytes(32).toString('hex'),proofId:betaProof})).status,503);
   assert.equal((await betaPost('/auth/logout',{})).status,201);
   assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n,journals);
   assert.equal(JSON.stringify((await db.query('SELECT * FROM ledger_balances ORDER BY account_id')).rows),balances);
  });
 } finally {
  for(const [k,v] of Object.entries(saved))if(v===undefined)delete process.env[k];else process.env[k]=v;
  await db.query("DELETE FROM system_settings WHERE key='synthetic_device_validation'");
  await db.query("UPDATE system_settings SET value=$1 WHERE key='manual_deposit_policy'",[JSON.stringify(priorPolicy)]);
 }
});



test('sensitive bank reveal requires permission and recent MFA or single-use step-up; never changes a payout',async()=>{
 const c=app.get((await import('../dist/common/crypto.service.js')).CryptoService);
 const {totp}=await import('../dist/modules/admin/admin.module.js');
 const seed=Array.from(randomBytes(20),b=>'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[b%32]).join('');
 const previousMode=process.env.NODE_ENV;
 const previousAdmin=(await db.query('SELECT totp_secret_ciphertext,last_totp_step FROM admin_users WHERE id=$1',[aid])).rows[0];
 const request={confirm:true,reason:'Isolated bank inspection only'};
 const before=JSON.stringify((await db.query('SELECT id,lifecycle,utr,manual_receipt_id FROM payouts ORDER BY id')).rows);
 const balances=JSON.stringify((await db.query('SELECT * FROM ledger_balances ORDER BY account_id')).rows);
 try{
  const outsider=randomUUID(),outsiderToken=c.token();await db.query("INSERT INTO admin_users(id,email_lookup_hash,email_ciphertext,password_hash,status) VALUES($1::uuid,$1::text,$2,'synthetic-only','active')",[outsider,c.encrypt('none@example.invalid','admin-email:'+outsider)]);await db.query("INSERT INTO admin_sessions(admin_user_id,family_id,refresh_token_hash,device_id_hash,expires_at) VALUES($1,$2,$3,'isolated-no-role',now()+interval '15 minutes')",[outsider,randomUUID(),c.digest(outsiderToken,'admin-session')]);
  assert.equal((await post('/admin/owner/banks/'+bank.id+'/reveal',request,{auth:outsiderToken})).status,403);
  await db.query("INSERT INTO admin_user_roles(admin_user_id,role_id) SELECT $1,id FROM admin_roles WHERE name='OWNER_ADMIN' ON CONFLICT DO NOTHING",[aid]);
  process.env.NODE_ENV='production';
  await db.query('UPDATE admin_users SET totp_secret_ciphertext=$2,last_totp_step=NULL WHERE id=$1',[aid,c.encrypt(seed,'admin-totp:'+aid)]);
  await db.query("UPDATE admin_sessions SET created_at=now(),expires_at=now()+interval '15 minutes' WHERE admin_user_id=$1",[aid]);
  const recent=await post('/admin/owner/banks/'+bank.id+'/reveal',request,{auth:admin});assert.equal(recent.status,201);assert.equal(recent.data.accountNumber,'123456789012');
  assert.equal((await post('/admin/owner/banks/'+bank.id+'/reveal',request,{auth:null})).status,401);
  assert.equal((await post('/admin/owner/banks/'+bank.id+'/reveal',request,{auth:token})).status,401);
  await db.query("UPDATE admin_sessions SET created_at=now()-interval '6 minutes' WHERE admin_user_id=$1",[aid]);
  const stale=await post('/admin/owner/banks/'+bank.id+'/reveal',request,{auth:admin});assert.equal(stale.status,403);assert.equal(stale.data.error.code,'ADMIN_RECENT_AUTH_REQUIRED');
  assert.equal((await post('/admin/manual/payouts/'+oid+'/beneficiary',request,{auth:admin})).status,403);
  const step=Math.floor(Date.now()/30000),code=totp(seed,step);
  const stepped=await post('/admin/manual/payouts/'+oid+'/beneficiary',request,{auth:admin,totpCode:code});assert.equal(stepped.status,201);assert.equal(stepped.data.bank.accountNumber,'123456789012');
  assert.equal((await post('/admin/manual/payouts/'+oid+'/beneficiary',request,{auth:admin,totpCode:code})).status,403);
  assert.equal((await post('/admin/manual/payouts/'+oid+'/beneficiary',request,{auth:admin,totpCode:totp(seed,step-5)})).status,403);
  await db.query("UPDATE admin_sessions SET created_at=now()-interval '16 minutes',expires_at=now()-interval '1 second' WHERE admin_user_id=$1",[aid]);
  assert.equal((await post('/admin/owner/banks/'+bank.id+'/reveal',request,{auth:admin})).status,401);
  await db.query("UPDATE admin_sessions SET expires_at=now()+interval '15 minutes' WHERE admin_user_id=$1",[aid]);
  const detail=await call('/admin/owner/users/'+uid,{auth:admin});assert.equal(detail.status,200);assert.ok(detail.data.banks.some(b=>b.holder&&b.publicUserId));assert.ok(!JSON.stringify(detail.data).includes('123456789012'));
  const audits=JSON.stringify((await db.query("SELECT sanitized_changes FROM audit_logs WHERE action IN ('manual.bank_reveal','owner.bank.revealed','admin.sensitive_auth.failed','admin.sensitive_auth.confirmed')")).rows);
  assert.ok(!audits.includes('123456789012'));assert.ok(!audits.includes(seed));
  assert.equal(JSON.stringify((await db.query('SELECT id,lifecycle,utr,manual_receipt_id FROM payouts ORDER BY id')).rows),before);
  assert.equal(JSON.stringify((await db.query('SELECT * FROM ledger_balances ORDER BY account_id')).rows),balances);
 }finally{
  process.env.NODE_ENV=previousMode;
  await db.query('UPDATE admin_users SET totp_secret_ciphertext=$2,last_totp_step=$3 WHERE id=$1',[aid,previousAdmin.totp_secret_ciphertext,previousAdmin.last_totp_step]);
  await db.query("UPDATE admin_sessions SET created_at=now(),expires_at=now()+interval '15 minutes' WHERE admin_user_id=$1",[aid]);
 }
});

test('receipt upload alone cannot complete a payout without explicit bank confirmation',async()=>{
 const b={...confirmBody};delete b.bankTransferConfirmed;
 assert.equal((await post('/admin/manual/payouts/'+oid+'/confirm',b,{auth:admin})).status,400);
 assert.equal((await post('/admin/manual/payouts/'+oid+'/confirm',{...b,bankTransferConfirmed:false},{auth:admin})).status,400);
});

test('owner order details and rejected requests retain balances and prevent later payout execution',async()=>{
 await db.query("UPDATE risk_flags SET state='resolved',resolved_at=now() WHERE user_id=$1",[uid]);
 const o=await order('100');const id=o.orderId;
 const details=await call('/admin/owner/orders/'+id,{auth:admin});assert.equal(details.status,200);assert.equal(details.data.user.id,uid);assert.ok(details.data.user.publicUserId);assert.ok(details.data.order.holder);assert.ok(!JSON.stringify(details.data).includes('123456789012'));
 const balances=JSON.stringify((await db.query('SELECT * FROM ledger_balances ORDER BY account_id')).rows);
 const b={action:'reject',confirm:true,note:'ISOLATED TEST: reject request without transferring or releasing funds'};
 const r=await post('/admin/manual/orders/'+id+'/review',b,{auth:admin});assert.equal(r.status,201);assert.equal(r.data.liabilityRetained,true);
 assert.equal((await post('/admin/manual/orders/'+id+'/review',b,{auth:admin})).data.duplicate,true);
 assert.equal((await post('/admin/manual/payouts/'+id+'/process',{note:'Must not process rejected test request'},{auth:admin})).status,409);
 assert.equal((await db.query('SELECT count(*)::int n FROM payouts WHERE order_id=$1',[id])).rows[0].n,0);
 assert.equal(JSON.stringify((await db.query('SELECT * FROM ledger_balances ORDER BY account_id')).rows),balances);
 assert.equal((await db.query("SELECT count(*)::int n FROM audit_logs WHERE action='manual.sell.reject' AND entity_id=$1",[id])).rows[0].n,1);
});

test('admin capabilities return only explicit grants and obey authentication',async()=>{
 assert.equal((await call('/admin/access',{auth:null})).status,401);assert.equal((await call('/admin/access',{auth:token})).status,401);
 const result=await call('/admin/access',{auth:admin});assert.equal(result.status,200);assert.equal(result.data.authenticated,true);
 assert.ok(result.data.permissions.includes('banks.reveal'));assert.ok(result.data.permissions.includes('ANDROID_RELEASE_PUBLISH'));assert.ok(!result.data.permissions.includes('FINANCIAL_ADMIN'));
 assert.deepEqual(Object.keys(result.data).sort(),['authenticated','permissions']);
});
test('manual payout confirmation respects disabled financial execution while protected reads remain available',async()=>{
 const {OwnerService}=await import('../dist/modules/owner/owner.service.js');await app.get(OwnerService).adjust(aid,uid,{confirm:true,reason:'ISOLATED disposable test funding for final gate regression',requestId:randomUUID(),amount:'1000',direction:'credit'});
 await db.query("UPDATE risk_flags SET state='resolved',resolved_at=now() WHERE user_id=$1",[uid]);
 const o=await order('100');const started=await post('/admin/manual/payouts/'+o.orderId+'/process',{note:'ISOLATED preparation to exercise pause gate'},{auth:admin});assert.equal(started.status,201);
 const count=(await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n;
 const saved=process.env.PAYOUTS_ENABLED;process.env.PAYOUTS_ENABLED='false';
 try{
  const response=await post('/admin/manual/payouts/'+o.orderId+'/confirm',{...confirmBody,utr:'ISOLATED-GATED-UTR',paidAt:new Date().toISOString()},{auth:admin});assert.equal(response.status,409);
  assert.equal((await call('/admin/manual/payouts/'+o.orderId,{auth:admin})).status,200);
  assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n,count);
 }finally{process.env.PAYOUTS_ENABLED=saved;}
});

test('narrow customer activation retains ordinary wallet sells while unrelated owner writes and settlement remain paused',async()=>{
 const flags=['OWNER_WALLET_ADJUSTMENTS_ENABLED','REFERRAL_REWARD_RELEASE_ENABLED','PAYOUTS_ENABLED'];
 const saved=Object.fromEntries(flags.map(k=>[k,process.env[k]]));
 try {
  Object.assign(process.env,{OWNER_WALLET_ADJUSTMENTS_ENABLED:'false',REFERRAL_REWARD_RELEASE_ENABLED:'false',PAYOUTS_ENABLED:'false'});
  const response=await order('100');
  assert.equal(response.status,'READY_FOR_PAYOUT');
  assert.equal(response.payout,null);
  assert.equal(response.payoutsEnabled,false);
  assert.equal((await post('/admin/manual/payouts/'+response.orderId+'/process',{note:'Isolated scope boundary validation'},{auth:admin})).status,409);
  const {OwnerService}=await import('../dist/modules/owner/owner.service.js');
  await assert.rejects(app.get(OwnerService).adjust(aid,uid,{confirm:true,reason:'Must remain blocked after activation',requestId:randomUUID(),amount:'100',direction:'credit'}),e=>e.getStatus()===403);
  assert.equal((await db.query('SELECT count(*)::int n FROM payouts WHERE order_id=$1',[response.orderId])).rows[0].n,0);
  assert.equal((await db.query('SELECT * FROM ledger_integrity_issues')).rows.length,0);
 }finally{for(const [k,v] of Object.entries(saved))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});

test('approved 515000-INR manual ceiling processes a 5000-USDT order without relaxing cooldown, daily budget or automation',async()=>{
 const flags=['PAYOUT_MAX_AMOUNT','PAYOUT_DAILY_LIMIT','PAYOUT_BANK_COOLDOWN_SECONDS','PAYOUTS_ENABLED','OWNER_WALLET_ADJUSTMENTS_ENABLED','REFERRAL_REWARD_RELEASE_ENABLED'];
 const saved=Object.fromEntries(flags.map(k=>[k,process.env[k]]));
 const {OwnerService}=await import('../dist/modules/owner/owner.service.js');
 const bankBefore=(await db.query('SELECT created_at FROM bank_accounts WHERE id=$1',[bank.id])).rows[0].created_at;
 try {
  await app.get(OwnerService).adjust(aid,uid,{confirm:true,reason:'ISOLATED disposable fixture funds for approved ceiling boundary test',requestId:randomUUID(),amount:'10000',direction:'credit'});
  Object.assign(process.env,{OWNER_WALLET_ADJUSTMENTS_ENABLED:'false',REFERRAL_REWARD_RELEASE_ENABLED:'false',PAYOUTS_ENABLED:'true',PAYOUT_MAX_AMOUNT:'10000000',PAYOUT_DAILY_LIMIT:'100000000',PAYOUT_BANK_COOLDOWN_SECONDS:'86400'});
  const orderResult=await order('5000');
  assert.equal(BigInt(orderResult.finalInrMinor),51500000n);
  assert.equal(BigInt(orderResult.feeInrMinor),0n);
  const path='/admin/manual/payouts/'+orderResult.orderId+'/process';
  const request={note:'ISOLATED synthetic review preparation only; no bank transfer'};
  const {ManualService}=await import('../dist/modules/manual/manual.service.js');
  const expectConflict=async reason=>{
   assert.equal((await post(path,request,{auth:admin})).status,409);
   await assert.rejects(app.get(ManualService).process(aid,orderResult.orderId,request),reason);
  };
  const before=JSON.stringify((await db.query('SELECT * FROM ledger_balances ORDER BY account_id')).rows);
  await expectConflict(/Payout amount requires review/);
  process.env.PAYOUT_MAX_AMOUNT='51499999';
  await expectConflict(/Payout amount requires review/);
  process.env.PAYOUT_MAX_AMOUNT='51500000';
  await db.query('UPDATE bank_accounts SET created_at=now() WHERE id=$1',[bank.id]);
  await expectConflict(/cooling period/);
  await db.query("UPDATE bank_accounts SET created_at=now()-interval '2 days' WHERE id=$1",[bank.id]);
  const day=new Date().toISOString().slice(0,10);
  const prior=(await db.query('SELECT committed_inr_minor::text amount FROM payout_platform_daily WHERE day=$1',[day])).rows[0];
  // Disposable fixture usage puts the request exactly one paise over the unchanged daily budget.
  await db.query('INSERT INTO payout_platform_daily(day,committed_inr_minor) VALUES($1,48500001) ON CONFLICT(day) DO UPDATE SET committed_inr_minor=48500001',[day]);
  try {
   await expectConflict(/Platform payout limit/);
  }finally{await db.query('UPDATE payout_platform_daily SET committed_inr_minor=$2 WHERE day=$1',[day,prior?.amount??'0']);}
  assert.equal((await db.query('SELECT count(*)::int n FROM payouts WHERE order_id=$1',[orderResult.orderId])).rows[0].n,0);
  const result=await post(path,request,{auth:admin});assert.equal(result.status,201,JSON.stringify(result.data));
  const p=(await db.query('SELECT lifecycle,provider,utr,manual_receipt_id,manual_paid_at,amount_inr_minor::text FROM payouts WHERE order_id=$1',[orderResult.orderId])).rows[0];
  assert.equal(p.amount_inr_minor,'51500000');assert.equal(p.lifecycle,'PROCESSING');assert.equal(p.provider,'manual');
  assert.equal(p.utr,null);assert.equal(p.manual_receipt_id,null);assert.equal(p.manual_paid_at,null);
  assert.equal(JSON.stringify((await db.query('SELECT * FROM ledger_balances ORDER BY account_id')).rows),before);
  assert.equal(process.env.AUTOMATED_BLOCKCHAIN_CREDIT,'false');assert.equal(process.env.AUTOMATED_PAYOUT,'false');
 }finally{
  await db.query('UPDATE bank_accounts SET created_at=$2 WHERE id=$1',[bank.id,bankBefore]);
  for(const [k,v] of Object.entries(saved))if(v===undefined)delete process.env[k];else process.env[k]=v;
 }
});

test('history empty pages preserve filtered totals and never include another account',async()=>{
 const first=await call('/history?type=deposits&limit=1');
 assert.equal(first.status,200);assert.equal(first.data.items.length,1);assert.ok(first.data.total>0);
 const beyond=await call('/history?type=deposits&limit=1&page=99999');
 assert.equal(beyond.status,200);assert.deepEqual(beyond.data.items,[]);
 assert.equal(beyond.data.total,first.data.total);assert.equal(beyond.data.hasMore,false);
 const empty=await call('/history?type=deposits&status=nonexistent&page=2');
 assert.deepEqual(empty.data.items,[]);assert.equal(empty.data.total,0);
 const {HistoryController}=await import('../dist/modules/orders/history.controller.js');
 const other=await app.get(HistoryController).list({user:{userId:randomUUID()}},'all',undefined,'1','20');
 assert.deepEqual(other.items,[]);assert.equal(other.total,0);
});

test('reviewed manual payment requires authority and evidence then settles once without another transfer',async()=>{
 await db.query("UPDATE risk_flags SET state='resolved',resolved_at=now() WHERE user_id=$1",[uid]);
 const created=await order('100');
 const started=await post('/admin/manual/payouts/'+created.orderId+'/process',{note:'ISOLATED synthetic bank transfer preparation'},{auth:admin});
 assert.equal(started.status,201,JSON.stringify(started.data));
 const id=created.orderId,payoutId=started.data.payoutId;
 const review=await post('/admin/manual/payouts/'+id+'/review',{note:'ISOLATED uncertain synthetic bank outcome'},{auth:admin});
 assert.equal(review.status,201);
 const before=(await call('/wallet')).data;
 const savedBalances=JSON.stringify((await db.query('SELECT * FROM ledger_balances ORDER BY account_id')).rows);
 assert.equal((await post('/admin/manual/payouts/'+id+'/process',{note:'Must not initiate another transfer'},{auth:admin})).status,409);
 await assert.rejects(db.query("UPDATE sell_orders SET status='completed' WHERE id=$1",[id]));
 const uploaded=await upload(admin,'receipt');assert.equal(uploaded.status,201);
 const minor=BigInt(created.finalInrMinor);
 const body={amountInr:`${minor/100n}.${String(minor%100n).padStart(2,'0')}`,utr:'ISOLATED-REVIEW-'+randomBytes(6).toString('hex'),paidAt:new Date().toISOString(),bankUsed:'Synthetic bank',note:'ISOLATED matching payment evidence reviewed',receiptId:uploaded.data.id,bankTransferConfirmed:true};
 const path='/admin/manual/payouts/'+id+'/confirm';
 assert.equal((await post(path,{...body,bankTransferConfirmed:false},{auth:admin})).status,400);
 assert.equal((await post(path,{...body,amountInr:'1'},{auth:admin})).status,400);
 assert.equal((await post(path,{...body,receiptId:randomUUID()},{auth:admin})).status,404);
 assert.equal((await post(path,body,{auth:token})).status,401);
 const {ManualService}=await import('../dist/modules/manual/manual.service.js');
 await assert.rejects(app.get(ManualService).confirm(randomUUID(),id,body),e=>e.getStatus()===403);
 const previous=process.env.PAYOUTS_ENABLED;process.env.PAYOUTS_ENABLED='false';
 try{assert.equal((await post(path,body,{auth:admin})).status,409);}finally{process.env.PAYOUTS_ENABLED=previous;}
 assert.equal(JSON.stringify((await db.query('SELECT * FROM ledger_balances ORDER BY account_id')).rows),savedBalances);
 const results=await Promise.all([post(path,body,{auth:admin}),post(path,body,{auth:admin})]);
 assert.ok(results.every(r=>r.status===201),JSON.stringify(results));
 assert.equal(results.filter(r=>r.data.duplicate===true).length,1);
 assert.equal((await call('/sell/orders/'+id)).data.status,'COMPLETED');
 assert.equal((await post(path,{...body,amountInr:'1'},{auth:admin})).status,409);
 assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals WHERE event_key=$1',['payout:'+payoutId])).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int n FROM payouts WHERE order_id=$1',[id])).rows[0].n,1);
 const after=(await call('/wallet')).data;
 assert.equal(after.availableUsdt,before.availableUsdt);
 assert.equal(databaseUnits(before.pendingInr,2)-databaseUnits(after.pendingInr,2),minor);
 assert.equal((await db.query("SELECT count(*)::int n FROM manual_action_history WHERE entity_id=$1 AND from_status='MANUAL_REVIEW' AND to_status='PAID'",[id])).rows[0].n,1);
 assert.deepEqual((await db.exec(await readFile(new URL('../operations/ledger-integrity.sql',import.meta.url),'utf8'))).flatMap(r=>r.rows),[]);
});

test('deposit integrity audit detects missing wallet credits including fee-bearing deposits',async()=>{
 const audit=await readFile(new URL('../operations/ledger-integrity.sql',import.meta.url),'utf8');
 const statement=audit.split(';').find(sql=>sql.includes("'MANUAL_CREDIT_MISMATCH'"));
 assert.ok(statement);
 // Shadow the audit input only; persisted immutable journals remain untouched.
 const missing=await db.query('WITH ledger_entries AS (SELECT * FROM ledger_entries WHERE false) '+statement);
 const credited=(await db.query("SELECT id FROM manual_deposit_requests WHERE status='CREDITED'")).rows;
 assert.ok(credited.length>0);
 assert.deepEqual(missing.rows.map(r=>r.manual_deposit_id).sort(),credited.map(r=>r.id).sort());
});

test('failed manual payment recovery restores original wallet once and never retries the transfer',async()=>{
 await db.query("UPDATE risk_flags SET state='resolved',resolved_at=now() WHERE user_id=$1",[uid]);
 const fee=(await db.query("INSERT INTO fees(version,flat_inr_minor,basis_points,effective_from) SELECT max(version)+1,25,50,now() FROM fees RETURNING id")).rows[0];
 await db.query("INSERT INTO rate_policies(version,mode,manual_rate,margin_bps,spread_bps,minimum_sell,maximum_sell,daily_limit,monthly_limit,quote_expiry_seconds,maximum_rate_age_seconds,fee_id,effective_from) SELECT max(version)+1,'manual',103,0,0,100,5000,20000,100000,60,120,$1,now() FROM rate_policies",[fee.id]);
 const before=(await call('/wallet')).data;
 const o=await order('100'),id=o.orderId;
 assert.ok(BigInt(o.feeInrMinor)>0n);
 assert.equal((await post('/admin/manual/payouts/'+id+'/process',{note:'ISOLATED failed-transfer fixture'},{auth:admin})).status,201);
 assert.equal((await post('/admin/manual/payouts/'+id+'/review',{note:'ISOLATED unknown bank outcome'},{auth:admin})).status,201);
 const file=await upload(admin,'receipt');
 const b={note:'ISOLATED bank evidence proves no payment occurred',receiptId:file.data.id,confirm:true,noTransferConfirmed:true};
 const path='/admin/manual/payouts/'+id+'/refund';
 assert.equal((await post('/admin/manual/payouts/'+oid+'/refund',b,{auth:admin})).status,409);
 assert.equal((await post(path,b,{auth:admin})).status,409);
 assert.equal((await post('/admin/manual/payouts/'+id+'/fail',{note:b.note,confirm:true,noTransferConfirmed:true},{auth:admin})).status,201);
 assert.equal((await post(path,{...b,noTransferConfirmed:false},{auth:admin})).status,400);
 assert.equal((await post(path,{...b,receiptId:randomUUID()},{auth:admin})).status,404);
 assert.equal((await post(path,b,{auth:token})).status,401);
 const grants=(await db.query("DELETE FROM admin_role_permissions WHERE permission_code='payouts.review' AND role_id IN (SELECT role_id FROM admin_user_roles WHERE admin_user_id=$1) RETURNING role_id",[aid])).rows;
 try{assert.equal((await post(path,b,{auth:admin})).status,403);}
 finally{for(const grant of grants)await db.query("INSERT INTO admin_role_permissions(role_id,permission_code) VALUES($1,'payouts.review')",[grant.role_id]);}
 const saved=process.env.PAYOUTS_ENABLED;process.env.PAYOUTS_ENABLED='false';
 try{assert.equal((await post(path,b,{auth:admin})).status,409);}finally{process.env.PAYOUTS_ENABLED=saved;}
 const pending=(await call('/wallet')).data;
 assert.equal(databaseUnits(before.availableUsdt,6)-databaseUnits(pending.availableUsdt,6),100000000n);
 await assert.rejects(db.query("UPDATE sell_orders SET status='cancelled' WHERE id=$1",[id]));
 const results=await Promise.all([post(path,b,{auth:admin}),post(path,b,{auth:admin})]);
 assert.ok(results.every(r=>r.status===201),JSON.stringify(results));
 assert.equal(results.filter(r=>r.data.duplicate).length,1);
 assert.equal((await post(path,{...b,note:'Different recovery evidence note'},{auth:admin})).status,409);
 const after=(await call('/wallet')).data;
 assert.equal(after.availableUsdt,before.availableUsdt);
 assert.equal(after.pendingInr,before.pendingInr);
 assert.equal((await call('/sell/orders/'+id)).data.status,'CANCELLED');
 assert.equal((await call('/sell/orders/'+id)).data.walletRefunded,true);
 assert.equal((await post('/admin/manual/payouts/'+id+'/process',{note:'Must never repeat a transfer'},{auth:admin})).status,409);
 assert.equal((await db.query('SELECT count(*)::int n FROM manual_order_refunds WHERE order_id=$1',[id])).rows[0].n,1);
 assert.equal((await db.query("SELECT count(*)::int n FROM ledger_journals WHERE event_key=$1",['reverse:fee:'+id])).rows[0].n,1);
 await assert.rejects(db.query('DELETE FROM manual_order_refunds WHERE order_id=$1',[id]));
 await assert.rejects(db.query("UPDATE sell_orders SET status='review' WHERE id=$1",[id]));
 assert.equal((await db.query('SELECT * FROM ledger_integrity_issues')).rows.length,0);
});

test('rejected unprocessed manual sell can be cancelled and its wallet funds recovered',async()=>{
 await db.query("UPDATE risk_flags SET state='resolved',resolved_at=now() WHERE user_id=$1",[uid]);
 const before=(await call('/wallet')).data;
 const o=await order('100'),id=o.orderId;
 assert.equal((await post('/admin/manual/orders/'+id+'/review',{action:'reject',confirm:true,note:'ISOLATED unprocessed request rejection'},{auth:admin})).status,201);
 const file=await upload(admin,'receipt');
 const result=await post('/admin/manual/payouts/'+id+'/refund',{receiptId:file.data.id,note:'ISOLATED no transfer for rejected request',confirm:true,noTransferConfirmed:true},{auth:admin});
 assert.equal(result.status,201,JSON.stringify(result.data));
 const after=(await call('/wallet')).data;assert.equal(after.availableUsdt,before.availableUsdt);assert.equal(after.pendingInr,before.pendingInr);
 assert.equal((await db.query('SELECT count(*)::int n FROM payouts WHERE order_id=$1',[id])).rows[0].n,0);
});

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
  NODE_ENV: "test", PAYOUTS_ENABLED:"true", PAYOUT_PROVIDER:"mock", PAYOUT_FAILED_ATTEMPT_LIMIT:"100", PAYOUT_BANK_COOLDOWN_SECONDS:"0", PAYOUT_WEBHOOK_SECRET:randomBytes(32).toString("hex"),
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
const { calculateRate, calculateFee, decimal } = await import(
  "../dist/modules/rates/money.js"
);
const { seedPhase3 } = await import("../scripts/seed-phase3.mjs");
let db, app, url, token, uid, bank, provider, deposits;
const password = "correct horse battery staple";
async function call(path, { method = "GET", body, auth = token, key } = {}) {
  const r = await fetch(url + path, {
    method,
    headers: {
      "content-type": "application/json",
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
  await db.query("UPDATE users SET verification_status='verified' WHERE id=$1",[uid]);
  const b=await post("/bank-accounts",{accountHolderName:"Phase Four",accountNumber:"123456789012",ifsc:"HDFC0001234",bankName:"HDFC Bank"},{key:randomUUID()});bank=b.data;
  assert.equal(b.status,201,JSON.stringify(b.data));
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

let ops,admin,adminId;
test('Phase7 admin requires explicit role; read-only observer cannot change controls',async()=>{
 ops=app.get((await import('../dist/common/operations.service.js')).OperationsService);
 const crypto=app.get((await import('../dist/common/crypto.service.js')).CryptoService);
 adminId=randomUUID();admin=crypto.token();
 await db.query("INSERT INTO admin_users(id,email_lookup_hash,email_ciphertext,password_hash,status) VALUES($1,$2,$3,$4,'active')",[adminId,crypto.digest('phase7@example.com','email'),crypto.encrypt('phase7@example.com','admin-email:'+adminId),await crypto.password(password)]);
 await db.query("INSERT INTO admin_sessions(admin_user_id,family_id,refresh_token_hash,device_id_hash,expires_at) VALUES($1,$2,$3,'test',now()+interval '15 minutes')",[adminId,randomUUID(),crypto.digest(admin,'admin-session')]);
 assert.equal((await call('/admin/operations/settings',{auth:admin})).status,403);
 await db.query("INSERT INTO admin_user_roles(admin_user_id,role_id) SELECT $1,id FROM admin_roles WHERE name='system-operator'",[adminId]);
 assert.equal((await call('/admin/operations/settings',{auth:admin})).status,200);
 assert.equal((await call('/admin/operations/users',{auth:admin})).status,403);
});
test('Phase7 public status contains only safe operational fields',async()=>{const s=await call('/system/status',{auth:null});assert.equal(s.status,200);assert.equal(s.data.mode,'NORMAL');assert.equal(s.data.DATABASE_URL,undefined);assert.equal(s.data.PAYOUT_API_KEY,undefined);});
async function change(patch){const current=await ops.status();const {version,message,...controls}=current;return ops.controls(adminId,{version,reason:'Approved isolated operational test',controls:{...controls,...patch}});}
test('Phase7 paused quote creation is rejected and does not consume idempotency',async()=>{await change({sell:false});const key=randomUUID();const r=await post('/sell/quote',{amountUsdt:'100'},{key});assert.equal(r.status,503,JSON.stringify(r.data));assert.equal((await db.query('SELECT count(*)::int n FROM idempotency_keys WHERE key=$1',[key])).rows[0].n,0);await change({sell:true});assert.equal((await post('/sell/quote',{amountUsdt:'100'},{key})).status,201);});
test('Phase7 configuration optimistic concurrency prevents lost emergency switch updates',async()=>{const {message,version,...controls}=await ops.status();const results=await Promise.allSettled([ops.controls(adminId,{version,reason:'First concurrency control request',controls}),ops.controls(adminId,{version,reason:'Second concurrency control request',controls})]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected').length,1);});
test('Phase7 read-only blocks new support and registration but preserves account reads',async()=>{await change({mode:'READ_ONLY'});assert.equal((await post('/support/tickets',{category:'OTHER',subject:'A support question',message:'Please review this issue'},{key:randomUUID()})).status,503);assert.equal((await post('/auth/register',{fullName:'Paused Registration',email:'paused@example.com',mobile:'+919876543210',password,termsAccepted:true},{auth:null})).status,503);assert.equal((await call('/users/me')).status,200);await change({mode:'NORMAL'});});
test('Phase7 blocked payout submission cannot call provider and retains queued attempt',async()=>{const p=await payout();await change({payouts:false});await assert.rejects(payoutService.submit(p.id));assert.equal((await db.query('SELECT lifecycle FROM payouts WHERE id=$1',[p.id])).rows[0].lifecycle,'QUEUED');assert.equal((await db.query('SELECT count(*)::int n FROM sandbox_payout_records')).rows[0].n,0);await change({payouts:true});await payoutService.submit(p.id);assert.equal((await db.query('SELECT lifecycle FROM payouts WHERE id=$1',[p.id])).rows[0].lifecycle,'PROCESSING');});
test('Phase7 end-to-end sandbox settlement continues during maintenance; ledger and admin agree',async()=>{
 const p=await submitted();await change({mode:'MAINTENANCE'});const result=await evidence(p.id);const first=await webhook(result);assert.equal(first.status,201,JSON.stringify(first.data));assert.equal((await webhook(result)).status,201);
 const detail=await call('/sell/orders/'+p.o.orderId);assert.equal(detail.data.status,'COMPLETED');assert.match(detail.data.payout.utr,/SANDBOX/);
 assert.equal((await db.query("SELECT count(*)::int n FROM ledger_journals WHERE event_key=$1",['payout:'+p.id])).rows[0].n,1);assert.equal((await db.query('SELECT * FROM ledger_integrity_issues')).rows.length,0);
 assert.equal((await call('/transactions')).status,200);assert.equal((await call('/notifications')).status,200);
 await db.query("INSERT INTO admin_user_roles(admin_user_id,role_id) SELECT $1,id FROM admin_roles WHERE name='financial-monitor'",[adminId]);
 for(const area of ['dashboard','wallets','ledger'])assert.equal((await call('/admin/operations/'+area,{auth:admin})).status,200);
 await payoutService.reconcile(p.id);await change({mode:'NORMAL'});
});
test('Phase7 provider health never implies live validation from configuration',async()=>{const r=await call('/admin/operations/providers',{auth:admin});assert.equal(r.status,200);assert.ok(r.data.every(x=>x.mode==='MOCK'||x.mode==='NOT_VALIDATED'));assert.ok(!JSON.stringify(r.data).includes(process.env.PAYOUT_WEBHOOK_SECRET));});
test('Phase7 admin bank response is masked and account actions audit and revoke sessions',async()=>{await db.query("INSERT INTO admin_user_roles(admin_user_id,role_id) SELECT $1,id FROM admin_roles WHERE name='account-operator'",[adminId]);const rows=(await call('/admin/operations/banks',{auth:admin})).data;assert.ok(rows.some(x=>x.masked_account==='XXXXXX9012'));assert.ok(!JSON.stringify(rows).includes('123456789012'));const r=await post('/admin/operations/users/'+uid+'/status',{status:'frozen',reason:'Investigating isolated account risk'},{auth:admin});assert.equal(r.status,201);assert.equal((await call('/users/me')).status,401);assert.ok((await db.query("SELECT id FROM audit_logs WHERE action='user.status' AND entity_id=$1",[uid])).rows.length);});
test('Phase7 production rejects mock defaults and unregistered adapters without a bypass',async()=>{const {assertProduction}=await import('../dist/config/production.js');assert.throws(()=>assertProduction({NODE_ENV:'development',DEPLOYMENT_ENV:'production'}),/PRODUCTION_RUNTIME/);assert.throws(()=>assertProduction({NODE_ENV:'production',MOCK_PROVIDER:'true'}),/MOCK_PROVIDER/);const cfg={...process.env,NODE_ENV:'production',DEPLOYMENT_ENV:'production',MOCK_PROVIDER:'false',DEV_OTP_EXPOSE:'false',DATABASE_URL:'postgresql://service:fixture-only-strong-password-123@db.invalid/db?sslmode=verify-full',REDIS_URL:'rediss://service:fixture-only-strong-password-123@redis.invalid:6379',CORS_ORIGINS:'https://admin.example.invalid',BLOCKCHAIN_NETWORK:'mainnet',TRON_NETWORK:'tron-mainnet',TRON_PROVIDER:'tron-http',TRON_API_URL:'https://tron.example.invalid',TRON_API_KEY:'not-a-live-key',TRON_USDT_CONTRACT:'Taaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',PAYOUT_API_URL:'https://payout.example.invalid',PAYOUT_API_KEY:randomBytes(32).toString('hex'),PAYOUT_API_SECRET:randomBytes(32).toString('hex'),TRON_REQUIRED_CONFIRMATIONS:'20'};for(const key of ['OTP_PROVIDER','VERIFICATION_PROVIDER','RATE_PROVIDER','PAYOUT_PROVIDER','EMAIL_PROVIDER','SMS_PROVIDER','PUSH_PROVIDER','SUPPORT_STORAGE_PROVIDER'])cfg[key]='renamed-live';assert.throws(()=>assertProduction(cfg),/PRODUCTION_ADAPTERS_NOT_REGISTERED/);assert.throws(()=>assertProduction({...cfg,CORS_ORIGINS:'https://admin.example.invalid/path'}),/EXACT_HTTPS/);assert.throws(()=>assertProduction({...cfg,REDIS_URL:'redis://service:fixture-only-strong-password-123@redis.invalid'}),/REDIS_TLS/);});
test('Phase7 malformed control values rejected; financial journal history remains immutable',async()=>{await assert.rejects(ops.controls(adminId,{version:1,reason:'Invalid configuration test',controls:{mode:'NORMAL',payouts:'true'}}));await assert.rejects(db.query("UPDATE ledger_journals SET description='tampered'"));await assert.rejects(db.query('DELETE FROM ledger_entries'));assert.equal((await db.query('SELECT * FROM ledger_integrity_issues')).rows.length,0);});
test('Phase7 policy update is versioned and never changes accepted quotes',async()=>{const q=(await db.query('SELECT id,rate_inr,net_inr_minor FROM quotes LIMIT 1')).rows[0];const p=(await db.query('SELECT version FROM rate_policies ORDER BY version DESC LIMIT 1')).rows[0];const body={version:p.version,reason:'Reviewed isolated manual rate policy',mode:'manual',manualRate:'93.125',minimumSell:'10',maximumSell:'1000',dailyLimit:'2000',monthlyLimit:'10000',marginBps:0,spreadBps:0,feeBasisPoints:50,fixedFeeMinor:'0',quoteExpiry:90};const r=await ops.policy(adminId,body);assert.equal(r.version,p.version+1);assert.deepEqual((await db.query('SELECT id,rate_inr,net_inr_minor FROM quotes WHERE id=$1',[q.id])).rows[0],q);await assert.rejects(ops.policy(adminId,body));await assert.rejects(ops.policy(adminId,{...body,version:r.version,fixedFeeMinor:1.1}));});
test('Phase7 operational admin views use valid schema and redact secrets',async()=>{await db.query("INSERT INTO admin_user_roles(admin_user_id,role_id) SELECT $1,id FROM admin_roles WHERE name='verification-reviewer'",[adminId]);for(const area of ['verification','banks','rates','fees','limits','audit','health','queues']){const r=await call('/admin/operations/'+area,{auth:admin});assert.equal(r.status,200,area+JSON.stringify(r.data));assert.ok(!JSON.stringify(r.data).includes('ciphertext'));}});
test('Phase7 ledger audit identifies no imbalance or missing settlement; queue namespaces validate',async()=>{const statements=await readFile(new URL('../operations/ledger-integrity.sql',import.meta.url),'utf8');const results=await db.exec(statements);assert.equal(results.flatMap(x=>x.rows).length,0);const {queuePrefix}=await import('../dist/common/queue-config.js');assert.equal(queuePrefix(),'bull');process.env.QUEUE_PREFIX='dt-isolated-test';try{assert.equal(queuePrefix(),'dt-isolated-test');process.env.QUEUE_PREFIX='invalid:namespace';assert.throws(()=>queuePrefix(),/INVALID_QUEUE_PREFIX/);}finally{delete process.env.QUEUE_PREFIX;}});

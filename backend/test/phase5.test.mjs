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
  db = new PGlite();
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
  await seedPhase3(db);
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
test('eligible payout creates immutable encrypted snapshot and one queued attempt',async()=>{const {o,id}=await payout();const p=await payoutService.view(id,uid);assert.equal(p.status,'QUEUED');assert.equal(p.sandbox,true);assert.equal(p.utr,null);assert.equal(p.bank.accountNumber,'XXXXXX9012');assert.equal(await payoutService.create(o.orderId),id);assert.equal((await db.query('SELECT count(*)::int n FROM payout_attempts WHERE payout_id=$1',[id])).rows[0].n,1);await assert.rejects(db.query("UPDATE payouts SET amount_inr_minor=1 WHERE id=$1",[id]));assert.equal((await call('/payouts/'+id,{auth:null})).status,401);assert.equal((await call('/payouts/'+randomUUID())).status,404);});
test('unfunded order, frozen account and disabled bank cannot create payout',async()=>{const o=await order();await assert.rejects(payoutService.create(o.orderId));const f=await funded();await db.query("UPDATE users SET status='frozen' WHERE id=$1",[uid]);await assert.rejects(payoutService.create(f.orderId));await db.query("UPDATE users SET status='active' WHERE id=$1",[uid]);await db.query('UPDATE bank_accounts SET disabled_at=now(),is_default=false WHERE id=$1',[bank.id]);await assert.rejects(payoutService.create(f.orderId));await db.query('UPDATE bank_accounts SET disabled_at=NULL,is_default=true WHERE id=$1',[bank.id]);});
test('submission never automatically creates success or UTR; repeated worker cannot double send',async()=>{const {o,id}=await submitted();assert.equal((await payoutService.view(id)).status,'PROCESSING');assert.equal((await call('/sell/orders/'+o.orderId)).data.status,'PAYOUT_PROCESSING');await payoutService.submit(id);assert.equal((await db.query('SELECT count(*)::int n FROM sandbox_payout_records s JOIN payout_attempts a ON a.provider_request_key=s.request_key WHERE a.payout_id=$1',[id])).rows[0].n,1);assert.equal((await payoutService.view(id)).utr,null);});
test('authenticated provider success atomically settles ledger and completes order once',async()=>{const {o,id}=await submitted();const result=await evidence(id),event=randomUUID();const response=await webhook(result,event);assert.equal(response.status,201,JSON.stringify(response.data));assert.equal((await webhook(result,event)).data.duplicate,true);const p=await payoutService.view(id);assert.equal(p.status,'SUCCESS');assert.match(p.utr,/^SANDBOX-UTR/);const detail=(await call('/sell/orders/'+o.orderId)).data;assert.equal(detail.status,'COMPLETED');assert.equal(detail.payout.utr,p.utr);assert.equal(detail.payoutExecuted,false);assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals WHERE event_key=$1',['payout:'+id])).rows[0].n,1);assert.equal((await call('/notifications')).data.some(n=>n.type==='transaction.completed'),true);assert.equal((await call('/history/'+id)).data.type,'payouts');assert.equal((await call('/transactions/'+id)).status,200);});
test('invalid signature, expired timestamp and altered replay rejected',async()=>{const {id}=await submitted(),r=await evidence(id);assert.equal((await webhook(r,randomUUID(),true)).status,401);assert.equal((await webhook(r,randomUUID(),false,String(Math.floor(Date.now()/1000)-600))).status,401);const event=randomUUID();assert.equal((await webhook(r,event)).status,201);assert.equal((await webhook({...r,amountMinor:'1'},event)).status,409);});
test('definitive failure retains liability and safe retry creates new immutable attempt',async()=>{const {o,id}=await submitted();await payoutService.apply(id,await evidence(id,'FAILED'));assert.equal((await call('/sell/orders/'+o.orderId)).data.status,'FAILED');assert.equal((await db.query('SELECT id FROM ledger_journals WHERE event_key=$1',['payout:'+id])).rows.length,0);await payoutService.retry(id,'test-admin','Verified definitive failure.');assert.equal((await db.query('SELECT count(*)::int n FROM payout_attempts WHERE payout_id=$1',[id])).rows[0].n,2);await payoutService.submit(id);await payoutService.apply(id,await evidence(id));assert.equal((await payoutService.view(id)).status,'SUCCESS');await assert.rejects(payoutService.retry(id,'test-admin','Unsafe double payout attempt.'));});
test('reversal webhook posts exact reversing journal and puts completed order under review',async()=>{const {o,id}=await submitted();await payoutService.apply(id,await evidence(id));const r=await evidence(id,'REVERSED');assert.equal((await webhook(r)).status,201);await webhook(r);assert.equal((await payoutService.view(id)).status,'REVERSED');assert.equal((await call('/sell/orders/'+o.orderId)).data.status,'MANUAL_REVIEW');assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals WHERE event_key=$1',['reverse:payout:'+id])).rows[0].n,1);assert.equal((await db.query("SELECT journal_id,asset_symbol FROM ledger_entries GROUP BY journal_id,asset_symbol HAVING sum(CASE WHEN side='debit' THEN amount ELSE -amount END)<>0")).rows.length,0);});
test('unknown submission timeout is reviewed and cannot be retried as new attempt',async()=>{const {id}=await payout();const original=payoutProvider.createPayout.bind(payoutProvider);payoutProvider.createPayout=async()=>{throw new Error('timeout provider SECRET');};try{await payoutService.submit(id);}finally{payoutProvider.createPayout=original;}assert.equal((await payoutService.view(id)).status,'MANUAL_REVIEW');await assert.rejects(payoutService.retry(id,'admin','Unknown provider outcome.'));const p=(await db.query('SELECT failure_reason FROM payouts WHERE id=$1',[id])).rows[0];assert.equal(p.failure_reason,'UNKNOWN_SUBMISSION_OUTCOME');});
test('poll fallback reconciles delayed success',async()=>{const {o,id}=await submitted();await evidence(id);await payoutService.refresh(id);assert.equal((await call('/sell/orders/'+o.orderId)).data.status,'COMPLETED');});
test('reconciliation detects mismatch without silently changing financial state',async()=>{const {id}=await submitted();await evidence(id);await payoutService.reconcile(id);assert.equal((await payoutService.view(id)).status,'PROCESSING');assert.equal((await db.query('SELECT issue_type FROM reconciliation_issues WHERE payout_id=$1',[id])).rows[0].issue_type,'STATUS_MISMATCH');});
test('wrong provider amount and unsubmitted success never settle',async()=>{const {id}=await submitted();const r=await evidence(id);await payoutService.apply(id,{...r,amountMinor:'1'});assert.equal((await payoutService.view(id)).status,'MANUAL_REVIEW');assert.equal((await db.query('SELECT id FROM ledger_journals WHERE event_key=$1',['payout:'+id])).rows.length,0);});
test('risk hold, new bank cooldown and payout limits enforced',async()=>{const o=await funded();process.env.PAYOUT_BANK_COOLDOWN_SECONDS='86400';await assert.rejects(payoutService.create(o.orderId));process.env.PAYOUT_BANK_COOLDOWN_SECONDS='0';process.env.PAYOUT_MAX_AMOUNT='1';await assert.rejects(payoutService.create(o.orderId));delete process.env.PAYOUT_MAX_AMOUNT;await db.query("INSERT INTO risk_flags(user_id,code,severity) VALUES($1,'MANUAL_TEST','high')",[uid]);await assert.rejects(payoutService.create(o.orderId));await db.query("UPDATE risk_flags SET state='resolved',resolved_at=now()");});
test('admin session without payout retry permission is denied',async()=>{const crypto=app.get((await import('../dist/common/crypto.service.js')).CryptoService),id=randomUUID(),t=crypto.token();await db.query("INSERT INTO admin_users(id,email_lookup_hash,email_ciphertext,password_hash,status) VALUES($1,$2,$3,$4,'active')",[id,crypto.digest('payout-admin@example.com','email'),crypto.encrypt('payout-admin@example.com','admin-email:'+id),await crypto.password(password)]);await db.query("INSERT INTO admin_sessions(admin_user_id,refresh_token_hash,family_id,device_id_hash,expires_at) VALUES($1,$2,gen_random_uuid(),'test-device',now()+interval '15 minutes')",[id,crypto.digest(t,'admin-session')]);assert.equal((await post('/admin/payouts/'+randomUUID()+'/retry',{reason:'Retry this failed payout.'},{auth:t})).status,403);});
test('blockchain reorg after payout preserves settlement and opens exposure review',async()=>{const {o,id}=await submitted();await payoutService.apply(id,await evidence(id));const detail=(await call('/sell/orders/'+o.orderId)).data;provider.transactions.get(detail.txHash).canonical=false;await deposits.inspect(detail.txHash);assert.equal((await call('/sell/orders/'+o.orderId)).data.status,'MANUAL_REVIEW');assert.equal((await db.query('SELECT id FROM ledger_journals WHERE event_key=$1',['reverse:payout:'+id])).rows.length,0);assert.equal((await db.query("SELECT id FROM reconciliation_issues WHERE payout_id=$1 AND issue_type='CHAIN_REORG_PAYOUT_EXPOSURE'",[id])).rows.length,1);});

test('signed failure webhook is authoritative and retries preserve old attempt',async()=>{const {id}=await submitted();assert.equal((await webhook(await evidence(id,'FAILED'))).status,201);assert.equal((await payoutService.view(id)).status,'FAILED');const a=(await db.query('SELECT id FROM payout_attempts WHERE payout_id=$1',[id])).rows[0];await assert.rejects(db.query("UPDATE payout_attempts SET provider_request_key='different' WHERE id=$1",[a.id]),/immutable/);});
test('declared transient non-acceptance is retryable but unknown failure is not',async()=>{const {id}=await payout();const original=payoutProvider.createPayout.bind(payoutProvider);const {PayoutTransientError}=await import('../dist/modules/payouts/payout.provider.js');payoutProvider.createPayout=async()=>{throw new PayoutTransientError(true);};try{await payoutService.submit(id);}finally{payoutProvider.createPayout=original;}assert.equal((await payoutService.view(id)).status,'FAILED');await payoutService.retry(id,'worker','Confirmed transient non-acceptance','service');await payoutService.submit(id);assert.equal((await payoutService.view(id)).status,'PROCESSING');});
test('only one active attempt is enforced by database and direct completion is rejected',async()=>{const {o,id}=await payout();await assert.rejects(db.query("INSERT INTO payout_attempts(payout_id,attempt_number,provider_request_key,status) VALUES($1,2,$2,'pending')",[id,randomUUID()]));await assert.rejects(db.query("UPDATE sell_orders SET status='completed',completed_at=now() WHERE id=$1",[o.orderId]));});

test('provider balance capability is explicit and production mock calls fail closed',async()=>{assert.equal((await payoutService.providerBalance()).supported,false);const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';try{await assert.rejects(payoutProvider.getPayoutStatus('not-a-real-transfer'));}finally{process.env.NODE_ENV=previous;}});
test('treasury permissions permit read/review and all actions create an audit event',async()=>{const {seedPhase5}=await import('../scripts/seed-phase5.mjs');await seedPhase5(db);const {id}=await payout();const crypto=app.get((await import('../dist/common/crypto.service.js')).CryptoService);const admin=(await db.query("SELECT id FROM admin_users LIMIT 1")).rows[0];await db.query("INSERT INTO admin_user_roles(admin_user_id,role_id) SELECT $1,id FROM admin_roles WHERE name='treasury' ON CONFLICT DO NOTHING",[admin.id]);const t=crypto.token();await db.query("INSERT INTO admin_sessions(admin_user_id,refresh_token_hash,family_id,device_id_hash,expires_at) VALUES($1,$2,gen_random_uuid(),'test-device',now()+interval '15 minutes')",[admin.id,crypto.digest(t,'admin-session')]);assert.equal((await call('/admin/payouts',{auth:t})).status,200);assert.equal((await call('/admin/payouts/'+id,{auth:t})).status,200);assert.equal((await post('/admin/payouts/'+id+'/review',{reason:'Treasury investigation requested.'},{auth:t})).status,201);assert.equal((await payoutService.view(id)).status,'MANUAL_REVIEW');assert.equal((await post('/admin/payouts/'+id+'/retry',{reason:'Unknown payout outcome needs investigation.'},{auth:t})).status,409);assert.ok((await db.query("SELECT id FROM audit_logs WHERE entity_id=$1 AND action='payout.review'",[id])).rows.length);assert.equal((await post('/admin/payouts/'+id+'/success',{}, {auth:t})).status,404);});
test('accepted-then-timeout resolves by polling without a second provider submission',async()=>{const {id}=await payout();const original=payoutProvider.createPayout.bind(payoutProvider);payoutProvider.createPayout=async input=>{await original(input);throw new Error('response lost');};try{await payoutService.submit(id);}finally{payoutProvider.createPayout=original;}assert.equal((await payoutService.view(id)).status,'MANUAL_REVIEW');await evidence(id);await payoutService.refresh(id);assert.equal((await payoutService.view(id)).status,'SUCCESS');assert.equal((await db.query('SELECT count(*)::int n FROM payout_attempts WHERE payout_id=$1',[id])).rows[0].n,1);});
test('settlement uses exact locked paise and public payout view hides sensitive bank data',async()=>{const {id}=await submitted();const r=await evidence(id);await payoutService.apply(id,r);await payoutService.apply(id,{...r,status:'PROCESSING'});assert.equal((await payoutService.view(id)).status,'SUCCESS');const lines=(await db.query("SELECT e.amount::text FROM ledger_entries e JOIN ledger_journals j ON j.id=e.journal_id WHERE j.event_key=$1",['payout:'+id])).rows;assert.equal(lines.length,2);const {databaseUnits}=await import('../dist/modules/rates/money.js');for(const l of lines)assert.equal(databaseUnits(l.amount,2),BigInt(r.amountMinor));const publicView=(await call('/payouts/'+id)).data;assert.equal(JSON.stringify(publicView).includes('123456789012'),false);assert.equal(publicView.provider,undefined);await assert.rejects(payoutService.view(id,randomUUID()));});
test('provider success without UTR cannot settle or complete',async()=>{const {id}=await submitted();const r=await evidence(id);delete r.utr;await assert.rejects(payoutService.apply(id,r));assert.equal((await payoutService.view(id)).status,'PROCESSING');});
test('provider types reject truthy string failure flags and numeric financial amounts',async()=>{const {validateResult}=await import('../dist/modules/payouts/payout.provider.js');assert.throws(()=>validateResult({requestKey:'test',reference:'test',amountMinor:'100',status:'FAILED',definitiveFailure:'false'}));assert.throws(()=>validateResult({requestKey:'test',reference:'test',amountMinor:100,status:'SUCCESS',utr:'UTR'}));});

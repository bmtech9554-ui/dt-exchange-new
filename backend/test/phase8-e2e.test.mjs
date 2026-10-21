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
  assert.equal((await call('/verification/status')).data.status,'REQUIRED');
  const verification=await post('/verification/start',{}, {key:randomUUID()});
  assert.equal(verification.status,201,JSON.stringify(verification.data));
  for(const record of verification.data.records){const submitted=await post('/verification/submit',{verificationId:record.id},{key:randomUUID()});assert.equal(submitted.status,201,JSON.stringify(submitted.data));}
  assert.equal((await call('/verification/status')).data.status,'VERIFIED');
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


let completed;
test('RC1 HTTP account verification to sandbox payout completion, notification, history and support',async()=>{
 const started=performance.now();
 const p=await submitted();completed=p;
 const initial=await call('/sell/orders/'+p.o.orderId);assert.equal(initial.data.status,'PAYOUT_PROCESSING');
 const result=await evidence(p.id);assert.match(result.utr,/SANDBOX/);
 const event=randomUUID();assert.equal((await webhook(result,event)).status,201);assert.equal((await webhook(result,event)).status,201);
 const detail=await call('/sell/orders/'+p.o.orderId);assert.equal(detail.data.status,'COMPLETED');assert.equal(detail.data.payout.utr,result.utr);
 for(const path of ['/users/me','/transactions','/notifications','/referrals/me','/support/faq'])assert.equal((await call(path)).status,200,path);
 const ticket=await post('/support/tickets',{category:'PAYOUT',subject:'RC1 sandbox acceptance',message:'Please confirm this sandbox-only transaction.'},{key:randomUUID()});assert.equal(ticket.status,201);assert.equal((await call('/support/tickets/'+ticket.data.id)).status,200);
 await payoutService.reconcile(p.id);
 console.log(JSON.stringify({evidence:'RC1_MOCK_E2E',mode:'MOCK',durationMs:Math.round(performance.now()-started),finalStatus:detail.data.status,providerReference:'SANDBOX_ONLY',liveValidated:false}));
});
test('RC1 repeat deposit, payout submission and ledger settlement cannot duplicate financial events',async()=>{
 const {o,id}=completed;
 const row=(await db.query('SELECT tx_hash FROM blockchain_transactions LIMIT 1')).rows[0];
 await Promise.all([deposits.inspect(row.tx_hash),deposits.inspect(row.tx_hash)]);
 await payoutService.submit(id);
 await webhook(await evidence(id));
 assert.equal((await db.query('SELECT count(*)::int n FROM payouts WHERE order_id=$1',[o.orderId])).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals WHERE event_key=$1',['payout:'+id])).rows[0].n,1);
 assert.equal((await db.query('SELECT * FROM ledger_integrity_issues')).rows.length,0);
});
test('RC1 final read-only ledger audit has no fixture integrity issues',async()=>{
 const results=await db.exec(await readFile(new URL('../operations/ledger-integrity.sql',import.meta.url),'utf8'));
 assert.equal(results.flatMap(x=>x.rows).length,0);
 const journals=(await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n;
 assert.ok(journals>0);console.log(JSON.stringify({evidence:'RC1_LEDGER_AUDIT',database:'PGlite or explicit isolated PostgreSQL harness',journalCount:journals,issues:0,productionData:false}));
});

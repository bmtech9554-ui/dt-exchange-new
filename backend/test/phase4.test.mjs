import "reflect-metadata";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
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
  NODE_ENV: "test",
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
  app = await NestFactory.create(AppModule, { logger: false });
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
});
after(async () => {
  await app?.close();
  await db?.close();
});
async function freshQuote(amount='100',extra={}){await db.query('DELETE FROM rate_limit_buckets');const r=await post('/sell/quote',{amountUsdt:amount,...extra},{key:randomUUID()});assert.equal(r.status,201,JSON.stringify(r.data));return r.data;}
async function order(amount='100',extra={}){const q=await freshQuote(amount,extra);const r=await post('/sell/orders',{quoteId:q.quoteId,bankAccountId:bank.id},{key:randomUUID()});assert.equal(r.status,201,JSON.stringify(r.data));return r.data;}
function transfer(o,changes={}){const hash=randomBytes(32).toString('hex');const t={network:'tron-mock',txHash:hash,eventIndex:0,contract:'DT-MOCK-USDT-CONTRACT',sender:'DT-MOCK-TRON-'+('a'.repeat(40)),receiver:o.depositAddress,rawAmount:'100000000',decimals:6,blockNumber:'1000',blockHash:'b'.repeat(64),timestamp:new Date().toISOString(),execution:'SUCCESS',...changes};provider.transactions.set(hash,{txHash:hash,transfers:[t],canonical:true,execution:'SUCCESS'});return hash;}
let accepted,confirmedHash;
test('order consumes quote atomically, locks terms and replays only same idempotency key',async()=>{
 const q=await freshQuote(),key=randomUUID(),body={quoteId:q.quoteId,bankAccountId:bank.id};
 const r=await post('/sell/orders',body,{key});assert.equal(r.status,201,JSON.stringify(r.data));accepted=r.data;
 assert.equal(accepted.status,'AWAITING_DEPOSIT');assert.equal(accepted.exchangeRate,q.exchangeRate);assert.equal(accepted.payoutExecuted,false);assert.match(accepted.depositAddress,/^DT-MOCK/);
 assert.equal((await post('/sell/orders',body,{key})).data.orderId,accepted.orderId);
 assert.equal((await post('/sell/orders',body,{key:randomUUID()})).status,400);
 assert.equal((await call('/sell/quote/'+q.quoteId)).data.status,'USED');
});
test('expired, unauthorized and wrong-bank quotes cannot become orders',async()=>{
 const q=await freshQuote();await db.query("UPDATE quote_states SET status='EXPIRED' WHERE quote_id=$1",[q.quoteId]);
 assert.equal((await post('/sell/orders',{quoteId:q.quoteId,bankAccountId:bank.id},{key:randomUUID()})).status,400);
 assert.equal((await post('/sell/orders',{quoteId:randomUUID(),bankAccountId:bank.id},{key:randomUUID()})).status,404);
 const other=await freshQuote();assert.equal((await post('/sell/orders',{quoteId:other.quoteId,bankAccountId:randomUUID()},{key:randomUUID()})).status,400);
 await call('/sell/quote/'+other.quoteId,{method:'DELETE'});
});
test('correct TRC20 transfer tracks confirmations without premature credit',async()=>{
 confirmedHash=transfer(accepted);provider.head=1000n;await deposits.inspect(confirmedHash);
 const r=await call('/sell/orders/'+accepted.orderId);assert.equal(r.data.status,'BLOCKCHAIN_CONFIRMING');assert.equal(r.data.confirmations,1);
 assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n,0);
 provider.head=1002n;await deposits.inspect(confirmedHash);const final=await call('/sell/orders/'+accepted.orderId);
 assert.equal(final.data.status,'READY_FOR_PAYOUT');assert.equal(final.data.payoutExecuted,false);assert.equal(final.data.txHash,confirmedHash);assert.equal(final.data.timeline.length,5);
});
test('ledger journals balance by currency and duplicate hash cannot credit twice',async()=>{
 const before=(await db.query('SELECT count(*)::int n FROM ledger_entries')).rows[0].n;
 await deposits.inspect(confirmedHash);await deposits.inspect(confirmedHash);
 assert.equal((await db.query('SELECT count(*)::int n FROM ledger_entries')).rows[0].n,before);
 assert.equal((await db.query("SELECT journal_id,asset_symbol FROM ledger_entries GROUP BY journal_id,asset_symbol HAVING sum(CASE WHEN side='debit' THEN amount ELSE -amount END)<>0")).rows.length,0);
 const w=(await call('/wallet')).data;assert.equal(BigInt(w.availableUsdt.split('.')[0]),0n);assert.equal(w.source,'ledger');assert.ok(Number(w.pendingInr)>0);
 assert.equal((await db.query('SELECT count(*)::int n FROM payouts')).rows[0].n,0);
});
test('history pagination and order ownership',async()=>{
 const h=await call('/history?limit=1');assert.equal(h.status,200,JSON.stringify(h.data));assert.equal(h.data.items.length,1);assert.equal(h.data.hasMore,true);
 assert.equal((await call('/history?type=payouts')).data.items.length,0);
 assert.equal((await call('/sell/orders/'+randomUUID())).status,404);
 assert.equal((await call('/sell/orders/'+accepted.orderId,{auth:null})).status,401);
});
test('state machine forbids fake payout completion at database boundary',async()=>{
 await assert.rejects(db.query("UPDATE sell_orders SET status='completed',completed_at=now() WHERE id=$1",[accepted.orderId]),/Illegal Phase 4/);
});
test('reorg reverses financial journals once and puts order into review',async()=>{
 provider.transactions.get(confirmedHash).canonical=false;await deposits.inspect(confirmedHash);await deposits.inspect(confirmedHash);
 assert.equal((await call('/sell/orders/'+accepted.orderId)).data.status,'MANUAL_REVIEW');
 const rows=(await db.query("SELECT balance::text FROM ledger_balances WHERE user_id=$1",[uid])).rows;assert.ok(rows.every(r=>Number(r.balance)===0));
 assert.equal((await db.query("SELECT count(*)::int n FROM ledger_journals WHERE event_type='reversal'")).rows[0].n,4);
});
for(const [name,change,reason] of [['underpayment',{rawAmount:'99000000'},'UNDERPAYMENT'],['overpayment',{rawAmount:'101000000'},'OVERPAYMENT'],['wrong token',{contract:'NOT-USDT'},'WRONG_TOKEN'],['wrong network',{network:'tron-mainnet'},'INVALID_OR_AMBIGUOUS_TRANSFER'],['failed transfer',{execution:'FAILED'},'INVALID_OR_AMBIGUOUS_TRANSFER']]){
 test(name+' is reviewed without credit',async()=>{
  await db.query("UPDATE risk_flags SET state='resolved',resolved_at=now()");const o=await order();const hash=transfer(o,change);await deposits.inspect(hash);
  assert.equal((await call('/sell/orders/'+o.orderId)).data.status,'MANUAL_REVIEW');
  assert.equal((await db.query('SELECT code FROM risk_flags WHERE dedupe_key=$1',[`chain:tron-mock:${hash}:${uid}:${reason}`])).rows[0].code,reason);
  assert.equal((await db.query('SELECT id FROM ledger_journals WHERE event_key=$1',[`deposit:tron-mock:${hash}`])).rows.length,0);
 });
}
test('wrong recipient is not matched or credited',async()=>{
 await db.query("UPDATE risk_flags SET state='resolved',resolved_at=now()");const o=await order();const hash=transfer(o,{receiver:'DT-MOCK-TRON-'+('c'.repeat(40))});await deposits.inspect(hash);assert.equal((await call('/sell/orders/'+o.orderId)).data.status,'AWAITING_DEPOSIT');
});
test('wallet deposit credits ledger balance; wallet-funded sell consumes it',async()=>{
 const a=await post('/wallet/deposit-address',{});assert.equal(a.status,201,JSON.stringify(a.data));
 const hash=transfer({depositAddress:a.data.address});await deposits.inspect(hash);
 assert.equal(Number((await call('/wallet')).data.availableUsdt),100);
 const o=await order('100',{fundingSource:'wallet'});assert.equal(o.status,'READY_FOR_PAYOUT');assert.equal(o.depositAddress,null);assert.equal(Number((await call('/wallet')).data.availableUsdt),0);
});
test('expired order and late payment require manual review',async()=>{
 await db.query("UPDATE risk_flags SET state='resolved',resolved_at=now()");const o=await order();const transitions=app.get((await import('../dist/modules/orders/order-transition.service.js')).OrderTransitionService);
 await db.transaction(tx=>transitions.move(tx,o.orderId,'expired','TEST_EXPIRY'));
 const hash=transfer(o);await deposits.inspect(hash);assert.equal((await call('/sell/orders/'+o.orderId)).data.status,'MANUAL_REVIEW');assert.equal((await db.query('SELECT id FROM ledger_journals WHERE event_key=$1',[`deposit:tron-mock:${hash}`])).rows.length,0);
});
test('multiple official transfers in a single hash are ambiguous and never credited',async()=>{
 await db.query("UPDATE risk_flags SET state='resolved',resolved_at=now()");const o=await order(),hash=transfer(o),r=provider.transactions.get(hash);r.transfers.push({...r.transfers[0],eventIndex:1});await deposits.inspect(hash);assert.equal((await call('/sell/orders/'+o.orderId)).data.status,'MANUAL_REVIEW');assert.equal((await db.query('SELECT id FROM ledger_journals WHERE event_key=$1',[`deposit:tron-mock:${hash}`])).rows.length,0);
});
test('scanner cursor commits only after matching and repeated scans remain idempotent',async()=>{
 const Scan=(await import('../dist/modules/blockchain/scan.service.js')).ScanService;
 const a=(await db.query("SELECT id FROM wallet_addresses WHERE purpose='wallet' LIMIT 1")).rows[0];
 await app.get(Scan).scan(a.id);await app.get(Scan).scan(a.id);
 assert.equal((await db.query('SELECT version FROM chain_scan_cursors WHERE wallet_address_id=$1',[a.id])).rows[0].version,2);
});
test('admin monitoring uses separate expiring sessions and live permission checks',async()=>{
 const {CryptoService}=await import('../dist/common/crypto.service.js');const crypto=app.get(CryptoService),id=randomUUID();
 await db.query("INSERT INTO admin_users(id,email_lookup_hash,email_ciphertext,password_hash,status) VALUES($1,$2,$3,$4,'active')",[id,crypto.digest('ops@example.com','email'),crypto.encrypt('ops@example.com','admin-email:'+id),await crypto.password(password)]);
 await db.query("INSERT INTO admin_user_roles(admin_user_id,role_id) SELECT $1,id FROM admin_roles WHERE name='operations'",[id]);
 assert.equal((await call('/admin/orders')).status,401);
 const login=await post('/admin/login',{email:'ops@example.com',password},{auth:null});assert.equal(login.status,201,JSON.stringify(login.data));const adminToken=login.data.accessToken;
 assert.equal((await call('/admin/orders',{auth:adminToken})).status,200);assert.equal((await call('/admin/deposits',{auth:adminToken})).status,200);
 assert.equal((await call('/users/me',{auth:adminToken})).status,401);
 const reviews=await call('/admin/reviews',{auth:adminToken});assert.ok(reviews.data.length);
 const r=await post(`/admin/reviews/${reviews.data[0].id}/acknowledge`,{reason:'Reviewed chain evidence; awaiting investigation.'},{auth:adminToken});assert.equal(r.status,201,JSON.stringify(r.data));assert.equal(r.data.financialValuesChanged,false);
 await db.query('DELETE FROM admin_user_roles WHERE admin_user_id=$1',[id]);assert.equal((await call('/admin/orders',{auth:adminToken})).status,403);
 await post('/admin/logout',{},{auth:adminToken});assert.equal((await call('/admin/orders',{auth:adminToken})).status,401);
});
test('TOTP implementation matches RFC 6238 SHA1 vector truncated to six digits',async()=>{
 const {totp}=await import('../dist/modules/admin/admin.module.js');assert.equal(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',1),'287082');
});
test('real provider address codec validates checksum and rejects altered addresses',async()=>{
 const {tronAddress,validTronAddress}=await import('../dist/modules/blockchain/tron-address.js');const address=tronAddress('41'+'a'.repeat(40));assert.equal(validTronAddress(address),true);assert.equal(validTronAddress(address.slice(0,-1)+(address.endsWith('1')?'2':'1')),false);
});
test('cross-user order creation and detail deny access; deposit detail is scoped',async()=>{
 await db.query('DELETE FROM rate_limit_buckets');await db.query("UPDATE risk_flags SET state='resolved',resolved_at=now()");
 const q=await freshQuote();const reg=await post('/auth/register',{fullName:'Second User',email:'second4@example.com',mobile:'+919876543219',password,termsAccepted:true},{auth:null});
 const login=await post('/auth/verify-otp',{challengeId:reg.data.challengeId,code:reg.data.developmentOtp,deviceId:'second-user'},{auth:null});assert.equal(login.status,201);const other=login.data.accessToken;
 assert.equal((await post('/sell/orders',{quoteId:q.quoteId,bankAccountId:bank.id},{key:randomUUID(),auth:other})).status,404);
 assert.equal((await call('/sell/orders/'+accepted.orderId,{auth:other})).status,404);
 const d=(await db.query('SELECT id FROM deposits WHERE user_id=$1 LIMIT 1',[uid])).rows[0];assert.equal((await call('/history/'+d.id)).status,200);assert.equal((await call('/history/'+d.id,{auth:other})).status,404);
 await call('/sell/quote/'+q.quoteId,{method:'DELETE'});
});
test('future timestamp and excess decimal precision fail closed',async()=>{
 await db.query("UPDATE risk_flags SET state='resolved',resolved_at=now()");const o=await order(),hash=transfer(o,{timestamp:new Date(Date.now()+3600000).toISOString()});await deposits.inspect(hash);assert.equal((await call('/sell/orders/'+o.orderId)).data.status,'MANUAL_REVIEW');
 assert.equal((await post('/sell/quote',{amountUsdt:'100.0000001'},{key:randomUUID()})).status,400);
});
test('full migration runner applies all numbered migrations and replays without changes',async()=>{
 const {migrate}=await import('../scripts/migrate.mjs');const fresh=new PGlite();try{const client={query:(sql,params)=>!params&&sql.split(';').length>2?fresh.exec(sql).then(r=>r.at(-1)):fresh.query(sql,params)};await migrate(client);await migrate(client);assert.equal((await fresh.query('SELECT count(*)::int n FROM schema_migrations')).rows[0].n,(await readdir(new URL("../migrations/",import.meta.url))).filter(f=>f.endsWith(".sql")).length);}finally{await fresh.close();}
});
test('quote wall-clock expiry and changed eligibility are rechecked on order acceptance',async()=>{
 await db.query("UPDATE risk_flags SET state='resolved',resolved_at=now()");const q=await freshQuote();
 const copy=(await db.query("INSERT INTO quotes(user_id,bank_account_id,funding_source,amount_usdt,rate_inr,gross_inr_minor,fee_inr_minor,net_inr_minor,exchange_rate_id,fee_id,rate_policy_id,expires_at) SELECT user_id,bank_account_id,funding_source,amount_usdt,rate_inr,gross_inr_minor,fee_inr_minor,net_inr_minor,exchange_rate_id,fee_id,rate_policy_id,now()+interval '0.1 second' FROM quotes WHERE id=$1 RETURNING id",[q.quoteId])).rows[0];
 await new Promise(r=>setTimeout(r,150));assert.equal((await post('/sell/orders',{quoteId:copy.id,bankAccountId:bank.id},{key:randomUUID()})).status,400);
 await db.query("UPDATE users SET verification_status='required' WHERE id=$1",[uid]);assert.equal((await post('/sell/orders',{quoteId:q.quoteId,bankAccountId:bank.id},{key:randomUUID()})).status,403);
 await db.query("UPDATE users SET verification_status='verified' WHERE id=$1",[uid]);assert.equal((await call('/sell/quote/'+q.quoteId)).data.status,'ACTIVE');await call('/sell/quote/'+q.quoteId,{method:'DELETE'});
});
test('RPC adapter decodes receipt logs and rejects inconsistent transaction IDs',async()=>{
 const {TronHttpProvider}=await import('../dist/modules/blockchain/providers/tron-http.provider.js');
 const original=globalThis.fetch,previous=process.env.TRON_API_URL;process.env.TRON_API_URL='https://rpc.invalid';const hash='d'.repeat(64),block='e'.repeat(64);let invalid=false;
 globalThis.fetch=async(url)=>{const path=new URL(url).pathname;return new Response(JSON.stringify(path.endsWith('gettransactionbyid')?{txID:invalid?'f'.repeat(64):hash,ret:[{contractRet:'SUCCESS'}]}:path.endsWith('getblockbynum')?{blockID:block,block_header:{raw_data:{number:99}}}:{id:hash,blockNumber:99,blockTimeStamp:Date.now(),receipt:{result:'SUCCESS'},log:[{address:'a'.repeat(40),topics:['ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef','0'.repeat(24)+'b'.repeat(40),'0'.repeat(24)+'c'.repeat(40)],data:BigInt(100000000).toString(16).padStart(64,'0')}] }),{status:200});};
 try{const p=new TronHttpProvider(),r=await p.getTransaction(hash);assert.equal(r.transfers[0].rawAmount,'100000000');assert.equal(r.transfers[0].blockHash,block);assert.equal(p.validateAddress(r.transfers[0].receiver),true);invalid=true;await assert.rejects(p.getTransaction(hash),/INCOMPLETE_TRANSACTION/);}finally{globalThis.fetch=original;if(previous===undefined)delete process.env.TRON_API_URL;else process.env.TRON_API_URL=previous;}
});
test('failed pending receipt leaves the confirmation queue and cannot later auto-credit',async()=>{
 await db.query("UPDATE risk_flags SET state='resolved',resolved_at=now()");const o=await order(),hash=transfer(o);provider.head=1000n;await deposits.inspect(hash);provider.transactions.get(hash).transfers[0].execution='FAILED';await deposits.inspect(hash);
 const d=(await db.query('SELECT d.status FROM deposits d JOIN blockchain_transactions b ON b.id=d.transaction_id WHERE b.tx_hash=$1',[hash])).rows[0];assert.equal(d.status,'review');
 const Scan=(await import('../dist/modules/blockchain/scan.service.js')).ScanService;assert.ok(!(await app.get(Scan).pending()).some(b=>b.tx_hash===hash));provider.head=1002n;provider.transactions.get(hash).transfers[0].execution='SUCCESS';await deposits.inspect(hash);assert.equal((await call('/sell/orders/'+o.orderId)).data.status,'MANUAL_REVIEW');
});
test('retired wallet addresses are hidden from allocation and late deposits reviewed',async()=>{
 await db.query("UPDATE risk_flags SET state='resolved',resolved_at=now()");const a=(await db.query("UPDATE wallet_addresses SET retired_at=now() WHERE user_id=$1 AND purpose='wallet' RETURNING *",[uid])).rows[0];assert.equal((await post('/wallet/deposit-address',{})).status,403);
 const hash=transfer({depositAddress:a.address});await deposits.inspect(hash);assert.equal((await db.query('SELECT id FROM ledger_journals WHERE event_key=$1',[`deposit:tron-mock:${hash}`])).rows.length,0);
});

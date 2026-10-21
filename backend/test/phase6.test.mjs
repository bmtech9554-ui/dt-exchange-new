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
let noticeService,referralService,ticketId,code,referredToken,referredId,referralId,adminToken;
test('notification events created atomically, paginated and marked read',async()=>{noticeService=app.get((await import('../dist/modules/notifications/notification.service.js')).NotificationService);const list=await call('/notifications?limit=2');assert.equal(list.status,200);assert.equal(list.data.length,2);assert.equal((await call('/notifications/'+list.data[0].id+'/read',{method:'PATCH'})).status,200);assert.ok((await db.query('SELECT read_at FROM notifications WHERE id=$1',[list.data[0].id])).rows[0].read_at);assert.equal((await call('/notifications/'+randomUUID()+'/read',{method:'PATCH'})).status,404);assert.equal((await call('/notifications?page=0')).status,400);assert.equal((await post('/notifications/read-all',{})).status,201);});
test('notification preferences protect security-critical alerts',async()=>{assert.equal((await call('/notifications/preferences',{method:'PATCH',body:{security:false}})).status,400);const p=await call('/notifications/preferences',{method:'PATCH',body:{email:false,referrals:false}});assert.equal(p.data.email,false);assert.equal(p.data.security,true);});
test('push tokens encrypted, session-bound and never returned',async()=>{const r=await post('/notifications/devices',{token:'private-push-token-123456',platform:'ANDROID'});assert.equal(r.status,201,JSON.stringify(r.data));assert.equal(r.data.token,undefined);const row=(await db.query('SELECT * FROM notification_devices WHERE id=$1',[r.data.id])).rows[0];assert.ok(row.session_family_id);assert.notEqual(String(row.token_ciphertext),'private-push-token-123456');assert.equal((await post('/notifications/devices',{token:'private-push-token-123456',platform:'ANDROID'})).data.id,r.data.id);});
test('outbox fanout and notification delivery are idempotent',async()=>{await noticeService.fanout();const count=(await db.query('SELECT count(*)::int n FROM notification_deliveries')).rows[0].n;await Promise.all([noticeService.fanout(),noticeService.fanout()]);assert.equal((await db.query('SELECT count(*)::int n FROM notification_deliveries')).rows[0].n,count);const d=(await db.query("SELECT id FROM notification_deliveries WHERE channel='EMAIL' LIMIT 1")).rows[0];assert.ok(d);await Promise.all([noticeService.deliver(d.id),noticeService.deliver(d.id)]);const row=(await db.query('SELECT * FROM notification_deliveries WHERE id=$1',[d.id])).rows[0];assert.equal(row.attempt_count,1);assert.equal(row.status,'SENT');assert.match(row.provider_ref,/SANDBOX/);});
test('notification retries record safe failure and bounded backoff',async()=>{const email=app.get((await import('../dist/modules/notifications/delivery.providers.js')).EmailProvider);const original=email.send;email.send=async()=>{throw new Error('SECRET raw provider error');};const id=await db.transaction(tx=>noticeService.create(tx,uid,randomUUID(),'SECURITY','Security test','Check your account.'));await noticeService.fanout();const d=(await db.query("SELECT id FROM notification_deliveries WHERE notification_id=$1 AND channel='EMAIL'",[id])).rows[0];try{await assert.rejects(noticeService.deliver(d.id));}finally{email.send=original;}let row=(await db.query('SELECT * FROM notification_deliveries WHERE id=$1',[d.id])).rows[0];assert.equal(row.status,'FAILED');assert.equal(row.failure_reason,'DELIVERY_UNAVAILABLE');await noticeService.deliver(d.id);row=(await db.query('SELECT * FROM notification_deliveries WHERE id=$1',[d.id])).rows[0];assert.equal(row.attempt_count,1);});
test('support creation/reply use durable request idempotency',async()=>{const key=randomUUID(),body={category:'PAYOUT',subject:'Payout status question',message:'Please help me check my payout status.'};const r=await post('/support/tickets',body,{key});assert.equal(r.status,201,JSON.stringify(r.data));ticketId=r.data.id;assert.equal((await post('/support/tickets',body,{key})).data.id,ticketId);assert.equal((await call('/support/tickets/'+ticketId)).data.messages.length,1);const k=randomUUID();await post('/support/tickets/'+ticketId+'/replies',{message:'An additional detail.'},{key:k});await post('/support/tickets/'+ticketId+'/replies',{message:'An additional detail.'},{key:k});assert.equal((await call('/support/tickets/'+ticketId)).data.messages.length,2);});
test('FAQ listing excludes unpublished content and support storage remains private',async()=>{const faqs=await call('/support/faq');assert.equal(faqs.status,200);assert.equal(faqs.data.length,7);const a=await post('/support/tickets/'+ticketId+'/attachments',{mimeType:'application/pdf',sizeBytes:1024});assert.equal(a.status,201);assert.equal(a.data.uploadUrl,null);assert.equal(a.data.sandbox,true);assert.equal((await post('/support/tickets/'+ticketId+'/attachments',{mimeType:'application/javascript',sizeBytes:1024})).status,400);assert.equal((await post('/support/tickets/'+ticketId+'/attachments',{mimeType:'application/pdf',sizeBytes:6000000})).status,400);});
test('security PIN hashes and persistent attempt lockout',async()=>{const r=await post('/settings/pin',{pin:'573829',password});assert.equal(r.status,201,JSON.stringify(r.data));const hash=(await db.query('SELECT security_pin_hash FROM user_profiles WHERE user_id=$1',[uid])).rows[0].security_pin_hash;assert.notEqual(hash,'573829');assert.equal((await post('/settings/pin/verify',{pin:'573829'})).data.authorizationGranted,false);for(let i=0;i<5;i++)assert.equal((await post('/settings/pin/verify',{pin:'111111'})).status,401);assert.equal((await post('/settings/pin/verify',{pin:'573829'})).status,429);assert.equal((await call('/settings')).data.pinSet,true);});
test('referral codes stable and campaigns explicitly configured',async()=>{referralService=app.get((await import('../dist/modules/referrals/referrals.service.js')).ReferralsService);code=await referralService.code(uid);assert.match(code,/^DT(?:[A-F0-9]{16}|[A-F0-9]{32})$/);assert.equal(await referralService.code(uid),code);assert.equal((await call('/referrals/me')).data.enabled,false);await assert.rejects(referralService.claim(uid,code));await db.query("UPDATE system_settings SET value=$1 WHERE key='referral_rules'",[JSON.stringify({enabled:true,rewardType:'FIXED_INR',rewardAmountMinor:'2500',minimumCompletedMinor:'10000',maximumRewards:5,startsAt:'2020-01-01T00:00:00Z',endsAt:'2100-01-01T00:00:00Z'})]);});
test('registration claims referral atomically; ownership enforced across support and notifications',async()=>{const r=await post('/auth/register',{fullName:'Referred Customer',email:'referred@example.com',mobile:'+919876543219',password,termsAccepted:true,referralCode:code},{auth:null});assert.equal(r.status,201,JSON.stringify(r.data));const l=await post('/auth/verify-otp',{challengeId:r.data.challengeId,code:r.data.developmentOtp,deviceId:'separate-referral-device'},{auth:null});referredToken=l.data.accessToken;referredId=(await call('/users/me',{auth:referredToken})).data.id;await db.query("UPDATE users SET verification_status='verified' WHERE id=$1",[referredId]);referralId=(await db.query('SELECT id FROM referrals WHERE referred_user_id=$1',[referredId])).rows[0].id;assert.equal((await call('/support/tickets/'+ticketId,{auth:referredToken})).status,404);assert.equal((await post('/support/tickets/'+ticketId+'/replies',{message:'Unauthorized'},{auth:referredToken,key:randomUUID()})).status,404);const n=(await call('/notifications')).data[0];assert.equal((await call('/notifications/'+n.id+'/read',{method:'PATCH',auth:referredToken})).status,404);assert.equal((await post('/notifications/devices',{token:'private-push-token-123456',platform:'IOS'},{auth:referredToken})).status,400);assert.equal((await referralService.reward(referralId)).rewarded,false);});
test('completed qualifying sandbox transaction rewards once with balanced ledger under concurrent calls',async()=>{const saved={token,uid,bank};token=referredToken;uid=referredId;bank=(await post('/bank-accounts',{accountHolderName:'Referred Customer',accountNumber:'555566667777',ifsc:'HDFC0001234',bankName:'HDFC Bank'},{key:randomUUID()})).data;try{const {id}=await submitted();await payoutService.apply(id,await evidence(id));assert.equal((await referralService.reward(referralId)).rewarded,false);process.env.REFERRAL_ALLOW_SANDBOX='true';const results=await Promise.all(Array.from({length:8},()=>referralService.reward(referralId)));assert.ok(results.every(r=>r.rewarded));assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals WHERE event_key=$1',['referral:'+referralId])).rows[0].n,1);assert.equal((await db.query('SELECT journal_id FROM ledger_entries GROUP BY journal_id HAVING sum(CASE WHEN side=\'debit\' THEN amount ELSE -amount END)<>0')).rows.length,0);assert.equal((await db.query('SELECT lifecycle,reward_inr_minor::text reward FROM referrals WHERE id=$1',[referralId])).rows[0].reward,'2500');}finally{token=saved.token;uid=saved.uid;bank=saved.bank;}});
test('admin least privilege denies actions, support role can reply but cannot manage referral rules',async()=>{const crypto=app.get((await import('../dist/common/crypto.service.js')).CryptoService),id=randomUUID();adminToken=crypto.token();await db.query("INSERT INTO admin_users(id,email_lookup_hash,email_ciphertext,password_hash,status) VALUES($1,$2,$3,$4,'active')",[id,crypto.digest('support@example.com','email'),crypto.encrypt('support@example.com','admin-email:'+id),await crypto.password(password)]);await db.query("INSERT INTO admin_sessions(admin_user_id,refresh_token_hash,family_id,device_id_hash,expires_at) VALUES($1,$2,gen_random_uuid(),'admin-device',now()+interval '15 minutes')",[id,crypto.digest(adminToken,'admin-session')]);assert.equal((await call('/admin/engagement/support',{auth:adminToken})).status,403);await db.query("INSERT INTO admin_user_roles(admin_user_id,role_id) SELECT $1,id FROM admin_roles WHERE name='support'",[id]);assert.equal((await call('/admin/engagement/support',{auth:adminToken})).status,200);assert.equal((await post('/admin/engagement/support/'+ticketId+'/action',{action:'reply',message:'We are reviewing your request.',reason:'Customer status request reviewed.'},{auth:adminToken})).status,201);assert.equal((await post('/admin/engagement/support/'+ticketId+'/action',{action:'note',message:'Private internal investigation.',reason:'Private case review discussion.'},{auth:adminToken})).status,201);assert.equal((await call('/support/tickets/'+ticketId)).data.messages.some(m=>m.internal),false);assert.equal((await call('/admin/engagement/support/'+ticketId,{auth:adminToken})).data.messages.some(m=>m.internal),true);assert.equal((await call('/admin/engagement/rules',{auth:adminToken})).status,403);assert.ok((await db.query("SELECT id FROM audit_logs WHERE action='engagement.reply'")).rows.length);});
test('closing ticket prevents additional user replies',async()=>{assert.equal((await post('/support/tickets/'+ticketId+'/close',{})).status,201);assert.equal((await post('/support/tickets/'+ticketId+'/replies',{message:'More detail'},{key:randomUUID()})).status,409);});
test('health endpoints and worker readiness expose no secrets',async()=>{assert.equal((await call('/health/live')).data.phase,7);assert.equal((await call('/health/ready')).status,200);process.env.HEALTH_REQUIRE_WORKERS='true';try{assert.equal((await call('/health/ready')).status,503);}finally{delete process.env.HEALTH_REQUIRE_WORKERS;}});
test('deletion cannot discard balances or financial history',async()=>{assert.equal((await post('/settings/delete-account',{password,reason:'Please close my account.'})).status,409);assert.ok((await db.query('SELECT id FROM users WHERE id=$1',[uid])).rows.length);});
test('concurrent quote consumption creates one order and concurrent deposits/payout creation post once',async()=>{const q=await freshQuote();const responses=await Promise.all(Array.from({length:8},()=>post('/sell/orders',{quoteId:q.quoteId,bankAccountId:bank.id},{key:randomUUID()})));assert.equal(responses.filter(r=>r.status===201).length,1);const o=responses.find(r=>r.status===201).data;assert.equal((await db.query('SELECT count(*)::int n FROM sell_orders WHERE quote_id=$1',[q.quoteId])).rows[0].n,1);const hash=transfer(o);await Promise.all(Array.from({length:8},()=>deposits.inspect(hash)));const ids=await Promise.all(Array.from({length:8},()=>payoutService.create(o.orderId)));assert.equal(new Set(ids).size,1);assert.equal((await db.query('SELECT count(*)::int n FROM payouts WHERE order_id=$1',[o.orderId])).rows[0].n,1);});
test('duplicate device referral is held for review before any reward',async()=>{await db.query('DELETE FROM rate_limit_buckets');const r=await post('/auth/register',{fullName:'Duplicate Device',email:'duplicate@example.com',mobile:'+919876543217',password,termsAccepted:true,referralCode:code},{auth:null});assert.equal(r.status,201);const l=await post('/auth/verify-otp',{challengeId:r.data.challengeId,code:r.data.developmentOtp,deviceId:'phase4-test'},{auth:null});const other=(await call('/users/me',{auth:l.data.accessToken})).data.id;await db.query("UPDATE users SET verification_status='verified' WHERE id=$1",[other]);const id=(await db.query('SELECT id FROM referrals WHERE referred_user_id=$1',[other])).rows[0].id;assert.equal((await referralService.reward(id)).review,true);assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals WHERE event_key=$1',['referral:'+id])).rows[0].n,0);});
test('admin announcements are bounded, published and audience-filtered; observer health is permissioned',async()=>{const aid=(await db.query("SELECT admin_user_id FROM admin_sessions WHERE device_id_hash='admin-device'")).rows[0].admin_user_id;await db.query("INSERT INTO admin_user_roles(admin_user_id,role_id) SELECT $1,id FROM admin_roles WHERE name IN ('engagement','observer') ON CONFLICT DO NOTHING",[aid]);const id=randomUUID();const body={action:'save',reason:'Publish a scheduled service announcement.',title:'Service update',message:'Support is available in your account.',audience:'SPECIFIC_USERS',priority:'NORMAL',userIds:[uid],startsAt:'2020-01-01T00:00:00Z',endsAt:'2100-01-01T00:00:00Z',published:true};assert.equal((await post('/admin/engagement/announcements/'+id+'/action',body,{auth:adminToken})).status,201);assert.equal((await call('/notifications/announcements')).data.length,1);assert.equal((await call('/notifications/announcements',{auth:referredToken})).data.length,0);assert.equal((await post('/admin/engagement/announcements/'+randomUUID()+'/action',{...body,userIds:Array(101).fill(uid)},{auth:adminToken})).status,400);assert.equal((await call('/admin/engagement/health',{auth:adminToken})).status,200);});
test('bounded admin notification batches deduplicate and reject oversized audiences',async()=>{const id=randomUUID(),body={action:'send',title:'Account update',message:'Please review the latest support information.',userIds:[uid],reason:'Requested customer service update.'};assert.equal((await post('/admin/engagement/notifications/'+id+'/action',body,{auth:adminToken})).status,201);await post('/admin/engagement/notifications/'+id+'/action',body,{auth:adminToken});assert.equal((await db.query('SELECT count(*)::int n FROM notifications WHERE dedupe_key=$1',['admin-send:'+id+':'+uid])).rows[0].n,1);assert.equal((await post('/admin/engagement/notifications/'+randomUUID()+'/action',{...body,userIds:Array(101).fill(uid)},{auth:adminToken})).status,400);});
test('provider circuit opens after bounded failures and uses sanitized error',async()=>{const service=app.get((await import('../dist/common/observability.service.js')).ObservabilityService);for(let i=0;i<5;i++)await assert.rejects(service.safeProviderCall('test-notification',async()=>{throw new Error('SECRET');}),/PROVIDER_UNAVAILABLE/);await assert.rejects(service.safeProviderCall('test-notification',async()=>true),/CIRCUIT_OPEN/);assert.equal((await db.query("SELECT failures FROM provider_circuits WHERE provider='test-notification'")).rows[0].failures,5);});
test('expired/revoked sessions cannot operate after logout',async()=>{assert.equal((await post('/sessions/logout-others',{})).status,201);assert.equal((await post('/auth/logout',{})).status,201);assert.equal((await call('/notifications')).status,401);});

test('registration OTP HTTP flow assigns public IDs and accrues exactly 0.1 USDT separately without ledger credit',async()=>{
 await db.query('DELETE FROM rate_limit_buckets');
 await db.query("UPDATE system_settings SET value=$1 WHERE key='registration_referral_policy'",[JSON.stringify({enabled:true,rewardUsdt:'0.1',event:'REGISTRATION_OTP',creditMode:'MANUAL_RELEASE'})]);
 const before=(await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n;
 async function register(email,mobile,device,referralCode){
  const r=await post('/auth/register',{fullName:'Synthetic Registration',email,mobile,password,termsAccepted:true,...(referralCode?{referralCode}:{})},{auth:null});
  assert.equal(r.status,201);
  const verified=await post('/auth/verify-otp',{challengeId:r.data.challengeId,code:r.data.developmentOtp,deviceId:device},{auth:null});
  assert.equal(verified.status,201);
  return {token:verified.data.accessToken,challenge:r.data};
 }
 const inviter=await register('master-inviter@example.invalid','+919000000151','master-inviter-isolated');
 const profile=(await call('/users/me',{auth:inviter.token})).data;
 assert.match(profile.publicUserId,/^\d+$/);assert.ok(BigInt(profile.publicUserId)>=1000n);
 const referral=(await call('/referrals/me',{auth:inviter.token})).data;
 const referred=await register('master-referred@example.invalid','+919000000152','master-referred-isolated',referral.code);
 const reward=await call('/referrals/me',{auth:inviter.token});
 assert.equal(reward.status,200);assert.equal(reward.data.totalEarnedUsdt,'0.100000');
 assert.equal(reward.data.availableReferralBalanceUsdt,'0.100000');assert.equal(reward.data.referralBalanceSpendable,false);
 assert.equal(reward.data.history[0].reward_status,'PENDING_MANUAL_RELEASE');
 assert.match(reward.data.history[0].referred_public_user_id,/^\d+$/);
 const replay=await post('/auth/verify-otp',{challengeId:referred.challenge.challengeId,code:referred.challenge.developmentOtp,deviceId:'master-referred-isolated'},{auth:null});
 assert.ok(![200,201].includes(replay.status));
 assert.equal((await call('/referrals/me',{auth:inviter.token})).data.totalEarnedUsdt,'0.100000');
 assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n,before);
 const row=(await db.query('SELECT r.id FROM referrals r JOIN referral_codes c ON c.user_id=r.referrer_id WHERE c.code=$1',[referral.code])).rows[0];
 assert.equal((await referralService.reward(row.id)).rewarded,false);
 assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n,before);
});

import 'reflect-metadata';
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {RegistrationRewards} from '../dist/modules/referrals/registration-rewards.js';
import {ReferralsService} from '../dist/modules/referrals/referrals.service.js';
import {LedgerService} from '../dist/modules/ledger/ledger.service.js';
import {EngagementAdminService} from '../dist/common/engagement-admin.service.js';
import {referralProgramPaused} from '../dist/modules/referrals/referral-availability.js';
import {AuthService} from '../dist/modules/auth/auth.service.js';
let db,svc,referrals,adapter,owner,referrer;
const policy={enabled:true,rewardUsdt:'0.1',event:'REGISTRATION_OTP',creditMode:'MANUAL_RELEASE'};
async function user(active=true){const id=randomUUID();await db.query("INSERT INTO users(id,email_lookup_hash,email_ciphertext,status,terms_version,terms_accepted_at,mobile_verified_at) VALUES($1,$2,'\\x00',$3,'test',now(),CASE WHEN $4 THEN now() ELSE NULL END)",[id,id,active?'active':'pending',active]);return id;}
before(async()=>{
 db=process.env.PHASE6_POSTGRES_URL ? await (await import('./postgres-harness.mjs')).realDatabase() : new PGlite();for(const f of (await readdir(new URL('../migrations/',import.meta.url))).sort())await db.exec('BEGIN;'+await readFile(new URL('../migrations/'+f,import.meta.url),'utf8')+';COMMIT;');
 await db.exec(await readFile(new URL('../seeds/001_reference.sql',import.meta.url),'utf8'));
 adapter={query:(...a)=>db.query(...a),transaction:fn=>db.transaction(fn)};
 const security={limit:async()=>{},audit:async(tx,uid,action,id,changes={})=>tx.query("INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES('user',$1,$2,'referral',$3,gen_random_uuid(),$4)",[uid,action,id,JSON.stringify(changes)])};
 svc=new RegistrationRewards(adapter,new LedgerService(),security);referrals=new ReferralsService(adapter,new LedgerService(),null,security);
 owner=randomUUID();await db.query("INSERT INTO admin_users(id,email_lookup_hash,email_ciphertext,password_hash,status) VALUES($1,$2,'\\x00','test-only','active')",[owner,owner]);
 await db.query("INSERT INTO admin_user_roles(admin_user_id,role_id) SELECT $1,id FROM admin_roles WHERE name='OWNER_ADMIN'",[owner]);
 await svc.save(owner,{confirm:true,version:1,reason:'Approved registration OTP reward',value:policy});referrer=await user();
});after(async()=>db?.close());

test('reversible pause blocks invitations and new rewards without changing existing records or admin access',async()=>{
 const code=await referrals.code(referrer),uid=await user();await referrals.claim(uid,code);
 const snapshot=async()=>JSON.stringify((await db.query("SELECT to_jsonb(r) data FROM referrals r ORDER BY id")).rows);
 const original=await snapshot();const before=await svc.overview(referrer);
 const previous=process.env.REFERRAL_PROGRAM_PAUSED;
 try{
  process.env.REFERRAL_PROGRAM_PAUSED='true';
  await assert.rejects(referrals.code(referrer),/paused/);
  await assert.rejects(referrals.claim(await user(),code),/paused/);
  await db.transaction(tx=>svc.verified(tx,uid));
  const id=(await db.query('SELECT id FROM referrals WHERE referred_user_id=$1',[uid])).rows[0].id;
  assert.deepEqual(await referrals.reward(id),{rewarded:false,paused:true});
  const overview=await referrals.overview(referrer);
  assert.equal(overview.code,null);assert.equal(overview.inviteLink,null);assert.equal(overview.invitationsPaused,true);
  assert.equal(overview.registrationPolicy.enabled,false);
  assert.equal((await svc.settings(owner)).value.enabled,true);
  assert.equal(overview.availableReferralBalanceUsdt,before.availableReferralBalanceUsdt);
  assert.equal(await snapshot(),original);assert.ok((await svc.admin(owner)).length);
  process.env.REFERRAL_PROGRAM_PAUSED='false';assert.equal(await referrals.code(referrer),code);
 }finally{if(previous===undefined)delete process.env.REFERRAL_PROGRAM_PAUSED;else process.env.REFERRAL_PROGRAM_PAUSED=previous;}
});

test('pause parsing is default-compatible and invalid configured values fail closed',()=>{
 assert.equal(referralProgramPaused('false'),false);assert.equal(referralProgramPaused(''),false);
 assert.equal(referralProgramPaused('true'),true);assert.equal(referralProgramPaused('typo'),true);
});

test('paused old invitation cannot break signup or trigger attribution; OTP requirement remains',async()=>{
 const previous=process.env.REFERRAL_PROGRAM_PAUSED;process.env.REFERRAL_PROGRAM_PAUSED='true';
 try{
  let attributed=false,otp=false;
  const auth=new AuthService(adapter,{password:async()=> 'isolated-hash',encrypt:()=>Buffer.from('test'),digest:v=>v},
   {limit:async()=>{},audit:async()=>{}},null,{claimTransaction:async()=>{attributed=true;throw Error('must not attribute')}});
  auth.requestOtp=async()=>{otp=true;return {challengeRequired:true}};
  const r=await auth.register({email:randomUUID()+'@example.invalid',mobile:'+919000000099',password:'test-only',fullName:'Synthetic Pause',referralCode:'OLD-INVALID'},'127.0.0.1');
  assert.equal(attributed,false);assert.equal(otp,true);assert.equal(r.challengeRequired,true);
 }finally{if(previous===undefined)delete process.env.REFERRAL_PROGRAM_PAUSED;else process.env.REFERRAL_PROGRAM_PAUSED=previous;}
});
test('codes exist, self/duplicate attribution blocked; OTP qualifies once without wallet credit',async()=>{
 const code=await referrals.code(referrer),uid=await user(false);
 await assert.rejects(referrals.claim(referrer,code));await referrals.claim(uid,code);await assert.rejects(referrals.claim(uid,code));
 await db.transaction(tx=>svc.verified(tx,uid));assert.equal((await db.query('SELECT count(*)::int n FROM referral_reward_entries')).rows[0].n,0);
 await db.query("UPDATE users SET status='active',mobile_verified_at=now() WHERE id=$1",[uid]);
 await Promise.all([db.transaction(tx=>svc.verified(tx,uid)),db.transaction(tx=>svc.verified(tx,uid))]);
 const r=await svc.overview(referrer);assert.equal(r.totalEarnedUsdt,'0.100000');assert.equal(r.availableReferralBalanceUsdt,'0.100000');assert.equal(r.history[0].reward_status,'PENDING_MANUAL_RELEASE');
 assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n,0);
 assert.ok(r.history[0].referred_public_user_id);await assert.rejects(db.query("UPDATE referral_reward_entries SET amount_usdt=2"));
 await assert.rejects(db.query("UPDATE referrals SET rule_snapshot='{}'"));
});

test('unresolved risk flags hold registration rewards without crediting either balance',async()=>{
 const uid=await user(),code=await referrals.code(referrer);await referrals.claim(uid,code);
 await db.query("INSERT INTO risk_flags(user_id,code,severity,sanitized_context) VALUES($1,'SYNTHETIC_REFERRAL_TEST','high','{}')",[uid]);
 await db.transaction(tx=>svc.verified(tx,uid));
 assert.equal((await db.query('SELECT review_required FROM referrals WHERE referred_user_id=$1',[uid])).rows[0].review_required,true);
 assert.equal((await db.query('SELECT count(*)::int n FROM referral_reward_entries e JOIN referrals r ON r.id=e.referral_id WHERE r.referred_user_id=$1',[uid])).rows[0].n,0);
});
test('policy changes retain historical snapshots; owner RBAC and optimistic updates apply',async()=>{
 const code=await referrals.code(referrer),uid=await user(false);await referrals.claim(uid,code);
 const p=await svc.settings(owner);await svc.save(owner,{confirm:true,version:p.version,reason:'Change prospective reward only',value:{...policy,rewardUsdt:'0.2'}});
 await assert.rejects(svc.save(owner,{confirm:true,version:p.version,reason:'Stale settings must fail',value:policy}));
 await assert.rejects(svc.settings(randomUUID()));
 await db.query("UPDATE users SET status='active',mobile_verified_at=now() WHERE id=$1",[uid]);await db.transaction(tx=>svc.verified(tx,uid));
 assert.equal((await svc.overview(referrer)).totalEarnedUsdt,'0.200000');
});
test('synthetic accounts cannot accrue real rewards and automatic release remains blocked',async()=>{
 const uid=await user(),code=await referrals.code(referrer);await referrals.claim(uid,code);
 await db.query("INSERT INTO system_settings(key,value) VALUES('synthetic_device_validation',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[JSON.stringify({userId:uid,enabled:false})]);
 await db.transaction(tx=>svc.verified(tx,uid));assert.equal((await db.query('SELECT review_required FROM referrals WHERE referred_user_id=$1',[uid])).rows[0].review_required,true);
 const id=(await db.query('SELECT id FROM referral_reward_entries LIMIT 1')).rows[0].id;
 process.env.TRANSACTIONS_ENABLED='false';await assert.rejects(svc.release(owner,id,{confirm:true,reason:'Must not bypass production gate'}));await assert.rejects(svc.release(randomUUID(),id,{confirm:true,reason:'Role cannot release rewards'}));
 assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n,0);
});
test('manual release requires controls and permission, posts one balanced journal and retains reward snapshot',async()=>{
 const id=(await db.query('SELECT id FROM referral_reward_entries ORDER BY created_at LIMIT 1')).rows[0].id;
 process.env.TRANSACTIONS_ENABLED='true';
 const controls={mode:'READ_ONLY',registrations:true,deposits:true,sell:true,payouts:true,referrals:true,notifications:true,support:true};
 await db.query("INSERT INTO system_settings(key,value) VALUES('operational_controls',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[JSON.stringify(controls)]);
 const body={confirm:true,reason:'Isolated manual reward release test'};await assert.rejects(svc.release(owner,id,body));
 await db.query("UPDATE system_settings SET value=$1 WHERE key='operational_controls'",[JSON.stringify({...controls,mode:'NORMAL'})]);
 const r=await Promise.all([svc.release(owner,id,body),svc.release(owner,id,body)]);assert.ok(r.every(x=>x.released));assert.ok(r.some(x=>x.duplicate));
 assert.equal((await db.query('SELECT count(*)::int n FROM referral_reward_releases')).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int n FROM ledger_integrity_issues')).rows[0].n,0);
 assert.equal((await svc.overview(referrer)).availableReferralBalanceUsdt,'0.100000');
 await assert.rejects(db.query("UPDATE referral_reward_releases SET reason='tamper'"));process.env.TRANSACTIONS_ENABLED='false';
});

test('referral reviewers can reject only unreleased rewards; read-only admins cannot review or release',async()=>{
 const viewer=randomUUID();
 await db.query("INSERT INTO admin_users(id,email_lookup_hash,email_ciphertext,password_hash,status) VALUES($1,$2,'\\x00','test-only','active')",[viewer,viewer]);
 const role=(await db.query("INSERT INTO admin_roles(name,description) VALUES('isolated_referral_viewer','Synthetic read-only test role') RETURNING id")).rows[0].id;
 await db.query("INSERT INTO admin_role_permissions(role_id,permission_code) VALUES($1,'referrals.read')",[role]);
 await db.query('INSERT INTO admin_user_roles(admin_user_id,role_id) VALUES($1,$2)',[viewer,role]);
 const read=await svc.admin(viewer);assert.ok(read.length);assert.ok(read.every(r=>!r.canReview&&!r.canRelease));
 assert.ok((await svc.admin(owner)).every(r=>r.canReview&&r.canRelease));
 const review=new EngagementAdminService(null,adapter,null,referrals);
 const pending=(await db.query('SELECT e.id,e.referral_id FROM referral_reward_entries e LEFT JOIN referral_reward_releases x ON x.reward_id=e.id WHERE x.reward_id IS NULL LIMIT 1')).rows[0];
 const body={action:'reject',reason:'Isolated review rejection for synthetic referral'};
 await assert.rejects(review.action(viewer,'referrals',pending.referral_id,body));
 await assert.rejects(svc.release(viewer,pending.id,{confirm:true,reason:body.reason}));
 const journals=(await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n;
 await review.action(owner,'referrals',pending.referral_id,body);
 assert.equal((await db.query('SELECT lifecycle FROM referrals WHERE id=$1',[pending.referral_id])).rows[0].lifecycle,'REJECTED');
 assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n,journals);
 assert.equal((await db.query("SELECT count(*)::int n FROM audit_logs WHERE entity_id=$1 AND action='engagement.reject'",[pending.referral_id])).rows[0].n,1);
 const released=(await db.query('SELECT e.referral_id FROM referral_reward_entries e JOIN referral_reward_releases x ON x.reward_id=e.id LIMIT 1')).rows[0];
 await assert.rejects(review.action(owner,'referrals',released.referral_id,body));
});

test('pause preserves nonzero earned/released rewards, balances, policy snapshots and audit history; resume is reversible',async()=>{
 const code=await referrals.code(referrer),pending=await user();await referrals.claim(pending,code);
 const existing=(await db.query('SELECT id FROM referrals WHERE referred_user_id=$1',[pending])).rows[0].id;
 const snapshot=async()=>{
  const out={};
  for(const table of ['referrals','referral_codes','referral_reward_entries','referral_reward_releases','ledger_accounts','ledger_journals','ledger_entries','audit_logs','system_settings'])
   out[table]=(await db.query(`SELECT to_jsonb(t) data FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
  return JSON.stringify(out);
 };
 assert.ok((await db.query('SELECT count(*)::int n FROM referral_reward_entries')).rows[0].n>0);
 assert.ok((await db.query('SELECT count(*)::int n FROM referral_reward_releases')).rows[0].n>0);
 const before=await snapshot(),overview=await svc.overview(referrer),previous=process.env.REFERRAL_PROGRAM_PAUSED;
 try{
  process.env.REFERRAL_PROGRAM_PAUSED='true';
  await assert.rejects(referrals.claim(pending,code),e=>e.getStatus()===409);
  await db.transaction(tx=>svc.verified(tx,pending));
  assert.deepEqual(await referrals.reward(existing),{rewarded:false,paused:true});
  const paused=await referrals.overview(referrer);
  assert.equal(paused.totalEarnedUsdt,overview.totalEarnedUsdt);
  assert.equal(paused.availableReferralBalanceUsdt,overview.availableReferralBalanceUsdt);
  assert.deepEqual(paused.history,overview.history);
  assert.ok((await svc.admin(owner)).length>0);
  assert.equal((await svc.settings(owner)).value.enabled,true);
  assert.equal(await snapshot(),before);
  process.env.REFERRAL_PROGRAM_PAUSED='false';
  assert.equal(await referrals.code(referrer),code);
  assert.equal((await referrals.overview(referrer)).invitationsPaused,false);
  // Toggling the switch never replays OTP completion or automatically releases money.
  assert.equal(await snapshot(),before);
 }finally{if(previous===undefined)delete process.env.REFERRAL_PROGRAM_PAUSED;else process.env.REFERRAL_PROGRAM_PAUSED=previous;}
});

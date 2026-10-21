import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {ManualService} from '../dist/modules/manual/manual.service.js';
test('manual wallet config is checksum validated, permission gated, versioned and audited without automatic-chain dependency',async()=>{
 const db=new PGlite();const env={...process.env};
 try{
  const dir=new URL('../migrations/',import.meta.url);
  for(const file of (await readdir(dir)).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
  const actor=randomUUID(),denied=randomUUID();
  for(const id of [actor,denied])await db.query("INSERT INTO admin_users(id,email_lookup_hash,email_ciphertext,password_hash,status) VALUES($1,$2,'x','synthetic','active')",[id,id]);
  await db.query("INSERT INTO admin_user_roles SELECT $1,id FROM admin_roles WHERE name='system-operator'",[actor]);
  await db.query("INSERT INTO admin_user_roles SELECT $1,id FROM admin_roles WHERE name='operations'",[denied]);
  const facade={query:(...args)=>db.query(...args),transaction:async fn=>{await db.exec('BEGIN');try{const result=await fn(facade);await db.exec('COMMIT');return result;}catch(e){await db.exec('ROLLBACK');throw e;}}};
  const service=new ManualService(facade,null,null,null,null,null);
  process.env.NODE_ENV='production';delete process.env.TRON_PROVIDER;delete process.env.MANUAL_COLLECTION_ADDRESS;process.env.TRANSACTIONS_ENABLED='false';
  const address='TReyJ2Amq4GhmrwdCuVwLPtpQCk1SUhBmn';
  const body={address,confirmAddress:address,network:'TRC20',asset:'USDT',version:0,reason:'Owner confirmed public wallet configuration'};
  await assert.rejects(service.updateDepositWallet(denied,body));
  await assert.rejects(service.updateDepositWallet(actor,{...body,address:address.slice(0,-1)+'a'}));
  await assert.rejects(service.updateDepositWallet(actor,{...body,confirmAddress:'wrong'}));
  await service.updateDepositWallet(actor,body);
  const config=await service.configuration();assert.equal(config.address,address);assert.equal(config.depositsEnabled,false);assert.equal(config.sandbox,false);assert.equal(config.network,'TRC20');
  await assert.rejects(service.updateDepositWallet(actor,body));
  assert.equal((await db.query("SELECT count(*)::int n FROM audit_logs WHERE action='manual.deposit_wallet.changed'")).rows[0].n,1);
  const policy={minimumDeposit:'100',dailyDepositLimit:'20000',monthlyDepositLimit:null,monthlyLimitEnabled:false,version:0,reason:'Owner approved deposit policy configuration'};
  await assert.rejects(service.updateDepositPolicy(denied,policy));
  await assert.rejects(service.updateDepositPolicy(actor,{...policy,monthlyLimitEnabled:true}));
  await assert.rejects(service.updateDepositPolicy(actor,{...policy,monthlyDepositLimit:'999999999'}));
  await service.updateDepositPolicy(actor,policy);
  const saved=await service.readDepositPolicy(actor);assert.equal(saved.monthlyDepositLimit,null);assert.equal(saved.monthlyLimitEnabled,false);assert.equal(saved.minimumDeposit,'100');assert.equal(saved.dailyDepositLimit,'20000');
  await assert.rejects(service.updateDepositPolicy(actor,policy));
  assert.equal((await db.query("SELECT count(*)::int n FROM audit_logs WHERE action='manual.deposit_policy.changed'")).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n,0);
 }finally{for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);await db.close();}
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RatesService} from '../dist/modules/rates/rates.service.js';
import {decimal,calculateFee} from '../dist/modules/rates/money.js';

test('manual admin rate uses approved final rate without provider calls or added fees and retains policy update time',async()=>{
 const effective=new Date('2026-10-07T00:00:00Z');
 const policy={version:1,mode:'manual',manual_rate:'103.00000000',effective_from:effective,margin_bps:0,spread_bps:0,flat_inr_minor:'0',basis_points:0,minimum_sell:'100',maximum_sell:'5000',daily_limit:'100000',monthly_limit:'100000',quote_expiry_seconds:60,maximum_rate_age_seconds:120};
 const db={query:async sql=>({rows:sql.startsWith('SELECT p.')?[policy]:[{id:'synthetic-rate'}]})};
 const provider={fetch:async()=>{throw new Error('External provider must not be called');}};
 const rate=await new RatesService(db,provider).current();
 assert.equal(rate.exchangeRate,'103.00000000');assert.equal(rate.source,'MANUAL_ADMIN');assert.equal(rate.sandbox,false);
 assert.equal(rate.rateLastUpdatedAt,effective.toISOString());assert.equal(rate.policyVersion,1);
 assert.equal(rate.minimumSell,'100');assert.equal(rate.maximumSell,'5000');
 assert.ok(Date.parse(rate.validUntil)-Date.parse(rate.timestamp)>=59900);
 assert.ok(Date.parse(rate.validUntil)-Date.parse(rate.timestamp)<=60100);
 for(const [usdt,expectedMinor] of [['100',1030000n],['250',2575000n],['5000',51500000n]]){
  const gross=decimal(usdt,6)*decimal(rate.exchangeRate,8)/1000000000000n;
  const fee=calculateFee(gross,BigInt(rate.fixedFeeInrMinor),rate.feeBasisPoints);
  assert.equal(fee,0n);assert.equal(gross-fee,expectedMinor);
 }
});

test('unapproved sell caps fail closed; approved single maximum is enforced using integer units',async()=>{
 const {LimitsService}=await import('../dist/modules/orders/limits.service.js');
 const service=new LimitsService();
 const tx={query:async sql=>({rows:sql.startsWith('SELECT status')?[{status:'active',verification_status:'verified'}]:sql.includes('WITH usage')?[{daily:'0',monthly:'0'}]:[]})};
 const policy={minimum_sell:'100',maximum_sell:'5000',daily_limit:null,monthly_limit:null};
 await assert.rejects(service.enforce(tx,'synthetic',100000000n,policy),/require configuration/);
 const configured={...policy,daily_limit:'5000',monthly_limit:'5000'}; // isolated test caps, not approved production values
 await service.enforce(tx,'synthetic',5000000000n,configured);
 await assert.rejects(service.enforce(tx,'synthetic',5000000001n,configured),/outside transaction limits/);
});

test('migration-only database supports authenticated rate snapshots without seed scripts',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const {readFile,readdir}=await import('node:fs/promises');const db=new PGlite();
 try{
  const dir=new URL('../migrations/',import.meta.url);for(const name of (await readdir(dir)).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile(new URL(name,dir),'utf8'));
  assert.deepEqual((await db.query('SELECT symbol,ledger_decimals FROM assets ORDER BY symbol')).rows,[{symbol:'INR',ledger_decimals:2},{symbol:'USDT',ledger_decimals:18}]);
  const fee=(await db.query("INSERT INTO fees(version,effective_from) VALUES(1,now()) RETURNING id")).rows[0];
  await db.query("INSERT INTO rate_policies(version,mode,manual_rate,minimum_sell,maximum_sell,daily_limit,monthly_limit,quote_expiry_seconds,maximum_rate_age_seconds,fee_id,effective_from) VALUES(1,'manual',103,100,5000,20000,100000,60,120,$1,now())",[fee.id]);
  const result=await new RatesService(db,{fetch:async()=>{throw Error('No market provider');}}).current();assert.equal(result.exchangeRate,'103.00000000');assert.equal(result.source,'MANUAL_ADMIN');assert.equal((await db.query('SELECT count(*)::int n FROM exchange_rates')).rows[0].n,1);assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n,0);
 }finally{await db.close();}
});
test('stale market observations and invalid manual rates fail safely',async()=>{
 const base={mode:'market',maximum_rate_age_seconds:120};
 const db={query:async()=>({rows:[base]})};
 await assert.rejects(new RatesService(db,{fetch:async()=>({rate:'103',observedAt:new Date(Date.now()-180000),source:'test',sandbox:true})}).current(),/Rate unavailable/);
 base.mode='manual';base.manual_rate='invalid';await assert.rejects(new RatesService(db,null).current(),/Invalid decimal/);
});

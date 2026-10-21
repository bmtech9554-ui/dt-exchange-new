import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {privateBetaEnabled, assertPrivateBeta, privateBetaWriteAllowed, requirePrivateBetaAccount, PRIVATE_BETA_ADDRESS} from '../dist/common/private-beta.js';
import {LedgerService} from '../dist/modules/ledger/ledger.service.js';
import {validTronAddress} from '../dist/modules/blockchain/tron-address.js';

const safe = {PRIVATE_BETA_MODE:'true', MANUAL_DEPOSIT_REVIEW:'true', MANUAL_PAYOUT:'true',
  AUTOMATED_BLOCKCHAIN_CREDIT:'false', AUTOMATED_PAYOUT:'false', TRANSACTIONS_ENABLED:'false',
  PAYOUTS_ENABLED:'false', MANUAL_DEPOSIT_SUBMISSIONS_ENABLED:'false', REFERRAL_PROGRAM_PAUSED:'true'};
async function withEnv(fn) {
  const old=Object.fromEntries(Object.keys(safe).map(k=>[k,process.env[k]]));
  Object.assign(process.env,safe);
  try {await fn();} finally {for(const [k,v] of Object.entries(old))if(v===undefined)delete process.env[k];else process.env[k]=v;}
}
test('private beta is off by default and cannot start with normal intake, execution or referral accrual enabled',()=>{
  assert.equal(privateBetaEnabled({}),false);assert.equal(privateBetaEnabled({PRIVATE_BETA_MODE:'false'}),false);
  assert.doesNotThrow(()=>assertPrivateBeta({}));assert.doesNotThrow(()=>assertPrivateBeta(safe));
  for(const key of Object.keys(safe))assert.throws(()=>assertPrivateBeta({...safe,[key]:'invalid'}));
  for(const key of ['TRANSACTIONS_ENABLED','PAYOUTS_ENABLED','AUTOMATED_BLOCKCHAIN_CREDIT','AUTOMATED_PAYOUT','MANUAL_DEPOSIT_SUBMISSIONS_ENABLED'])
    assert.throws(()=>assertPrivateBeta({...safe,[key]:'true'}));
  assert.throws(()=>assertPrivateBeta({...safe,REFERRAL_PROGRAM_PAUSED:'false'}));
});
test('beta receiving identifier is visibly synthetic and cannot be a TRON payment address',()=>{
  assert.equal(validTronAddress(PRIVATE_BETA_ADDRESS),false);assert.match(PRIVATE_BETA_ADDRESS,/SYNTHETIC-NONPAYABLE/);
});
test('beta write boundary permits evidence and quotes but denies orders, custody, arbitrary new routes and financial writes',()=>{
  for(const path of ['/api/v1/manual/files','/api/v1/manual/deposits','/api/v1/bank-accounts','/api/v1/sell/quote','/api/v1/auth/logout'])
    assert.equal(privateBetaWriteAllowed('POST',path),true);
  for(const path of ['/api/v1/sell/orders','/api/v1/wallet/deposit-address','/api/v1/referrals/claim','/api/v1/future-financial-action','/api/v1/manual/deposits/approve'])
    assert.equal(privateBetaWriteAllowed('POST',path),false);
  assert.equal(privateBetaWriteAllowed('GET','/api/v1/wallet'),true);
});
test('beta account requires intact synthetic protection, exact account/build and a bounded explicit window',async()=>withEnv(async()=>{
  const now=Date.now(),base={userId:'test-user',enabled:true,androidVersionCode:'8017',startedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+600000).toISOString()};
  const mock=(value,protectedAccount=true)=>({query:async(sql,params)=>({rows:sql.startsWith('SELECT 1')?(protectedAccount&&params[0]==='test-user'?[{}]:[]):[{value}]})});
  await requirePrivateBetaAccount(mock(base),'test-user','8017');
  await assert.rejects(requirePrivateBetaAccount(mock(base),'other','8017'));
  await assert.rejects(requirePrivateBetaAccount(mock(base),'test-user','8016'));
  await assert.rejects(requirePrivateBetaAccount(mock(base),'test-user',''));
  await assert.rejects(requirePrivateBetaAccount(mock(base,false),'test-user','8017'));
  for(const change of [{enabled:false},{startedAt:null},{startedAt:new Date(now+10000).toISOString()},
    {expiresAt:new Date(now-1).toISOString()},{expiresAt:new Date(now+3600001).toISOString()},
    {androidVersionCode:'not-a-build'},{userId:'other'}])
    await assert.rejects(requirePrivateBetaAccount(mock({...base,...change}),'test-user','8017'));
}));
test('beta mode blocks ledger posting even when called outside HTTP authorization',async()=>withEnv(async()=>{
  let queried=false;
  await assert.rejects(new LedgerService().post({query:async()=>{queried=true;throw Error('must not write');}},'test','test','test',[]),e=>e.getStatus()===503);
  assert.equal(queried,false);
}));

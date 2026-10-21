import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OwnerService} from '../dist/modules/owner/owner.service.js';
import {OperationsService} from '../dist/common/operations.service.js';
import {RegistrationRewards} from '../dist/modules/referrals/registration-rewards.js';
import {readEnvironment} from '../dist/config/environment.js';

async function withFlags(flags, run) {
 const old=Object.fromEntries(Object.keys(flags).map(k=>[k,process.env[k]]));
 try {Object.assign(process.env,flags);await run();}
 finally {for(const [k,v] of Object.entries(old))if(v===undefined)delete process.env[k];else process.env[k]=v;}
}

test('manual activation opt-outs reject malformed configuration',()=>{
 for(const key of ['OWNER_WALLET_ADJUSTMENTS_ENABLED','REFERRAL_REWARD_RELEASE_ENABLED']){
  assert.throws(()=>readEnvironment({NODE_ENV:'test',[key]:'yes'}));
  for(const value of ['true','false'])assert.equal(readEnvironment({NODE_ENV:'test',[key]:value})[key],value);
 }
});

test('enabled customer execution cannot implicitly enable owner adjustments or old referral releases',async()=>{
 const db={query:async()=>({rows:[{permission_code:'referrals.release'}]}),transaction:()=>assert.fail('No financial transaction may begin')};
 const owner=new OwnerService(db,null,new OperationsService(db,null),null),rewards=new RegistrationRewards(db,null,null);
 await withFlags({TRANSACTIONS_ENABLED:'true',OWNER_WALLET_ADJUSTMENTS_ENABLED:'false',REFERRAL_REWARD_RELEASE_ENABLED:'false'},async()=>{
  await assert.rejects(owner.adjust('owner','user',{confirm:true}),e=>e.getStatus()===403);
  await assert.rejects(rewards.release('owner','reward',{confirm:true,reason:'Isolated permission boundary test'}),e=>e.getStatus()===403);
 });
});

test('operation opt-ins cannot bypass the shared transaction pause or RBAC',async()=>{
 for(const permitted of [true,false]){
  const db={query:async()=>({rows:permitted?[{permission_code:'referrals.release'}]:[]}),transaction:()=>assert.fail('Unexpected financial write')};
  await withFlags({TRANSACTIONS_ENABLED:permitted?'false':'true',OWNER_WALLET_ADJUSTMENTS_ENABLED:'true',REFERRAL_REWARD_RELEASE_ENABLED:'true'},async()=>{
   await assert.rejects(new OwnerService(db,null,new OperationsService(db,null),null).adjust('admin','user',{}),e=>e.getStatus()===403);
   await assert.rejects(new RegistrationRewards(db,null).release('admin','reward',{confirm:true,reason:'Isolated permission boundary test'}),e=>e.getStatus()===403);
  });
 }
});

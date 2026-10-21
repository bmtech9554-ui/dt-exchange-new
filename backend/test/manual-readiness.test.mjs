import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HealthController} from '../dist/health/health.controller.js';
test('manual readiness excludes disabled financial workers without weakening infrastructure checks',async()=>{
 const keys=['NODE_ENV','HEALTH_REQUIRE_WORKERS','TRANSACTIONS_ENABLED','PAYOUTS_ENABLED','MANUAL_DEPOSIT_REVIEW','MANUAL_PAYOUT','REDIS_URL'];const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try {
 Object.assign(process.env,{NODE_ENV:'test',HEALTH_REQUIRE_WORKERS:'true',TRANSACTIONS_ENABLED:'true',PAYOUTS_ENABLED:'true',MANUAL_DEPOSIT_REVIEW:'true',MANUAL_PAYOUT:'true'});delete process.env.REDIS_URL;
 let required;const c=new HealthController({ready:async()=>true,query:async(_s,p)=>{required=p[0];return {rows:p[0].map(worker=>({worker}))}}});
 await assert.rejects(c.ready());assert.deepEqual(required,['engagement']);
 process.env.MANUAL_DEPOSIT_REVIEW='false';process.env.MANUAL_PAYOUT='false';
 await assert.rejects(c.ready());assert.deepEqual(required,['engagement','blockchain','payouts']);
 } finally {for(const k of keys){if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];}}
});

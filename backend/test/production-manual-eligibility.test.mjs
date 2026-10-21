import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manualIdentityOptional, selfDeclaredManualBanks } from '../dist/config/manual-mode.js';
import { LimitsService } from '../dist/modules/orders/limits.service.js';
import { ManualService } from '../dist/modules/manual/manual.service.js';

test('manual mode never waives production identity or bank verification',async()=>{
  const saved={...process.env};
  try {
    Object.assign(process.env,{NODE_ENV:'production',MANUAL_DEPOSIT_REVIEW:'true',MANUAL_PAYOUT:'true',AUTOMATED_PAYOUT:'false'});
    assert.equal(manualIdentityOptional(),false);
    assert.equal(selfDeclaredManualBanks(),false);
    for(const verification_status of ['required','pending','under_review','rejected']) {
      const db={query:async()=>({rows:[{status:'active',verification_status}]})};
      await assert.rejects(new LimitsService().enforce(db,'user',100000000n,{}),/eligible/);
      await assert.rejects(new ManualService().eligible(db,'user'),/Verified account/);
    }
    const queries=[];
    const verifiedDb={query:async sql=>{
      queries.push(sql);
      return {rows:sql.includes('FROM users')?[{status:'active',verification_status:'verified'}]:[]};
    }};
    await new ManualService().eligible(verifiedDb,'user');
    assert.ok(queries.some(q=>q.includes('risk_flags')));
    process.env.NODE_ENV='test';
    assert.equal(manualIdentityOptional(),true);
    assert.equal(selfDeclaredManualBanks(),true);
  } finally {
    for(const key of ['NODE_ENV','MANUAL_DEPOSIT_REVIEW','MANUAL_PAYOUT','AUTOMATED_PAYOUT']) {
      if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];
    }
  }
});

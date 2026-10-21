import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DisabledTronProvider,dormantManualChain} from '../dist/modules/blockchain/disabled-tron.provider.js';
test('manual production chain port is dormant only with explicit automation disabled',()=>{
 const env={NODE_ENV:'production',MANUAL_DEPOSIT_REVIEW:'true',AUTOMATED_BLOCKCHAIN_CREDIT:'false'};
 assert.equal(dormantManualChain(env),true);
 for(const k of Object.keys(env))assert.equal(dormantManualChain({...env,[k]:''}),false);
});
test('dormant chain never manufactures data or successful validations',async()=>{
 const p=new DisabledTronProvider();
 for(const method of ['getTransaction','getLatestBlock','getBlockHash','fetchIncomingTransfers'])await assert.rejects(p[method](),/disabled/);
 assert.throws(()=>p.validateAddress(),/disabled/);assert.throws(()=>p.checkUsdtContract(),/disabled/);
});

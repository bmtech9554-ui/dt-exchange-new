import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WalletsService} from '../dist/modules/wallets/wallets.service.js';
test('production ledger balance does not depend on disabled blockchain providers',async()=>{
 const old={...process.env};
 Object.assign(process.env,{NODE_ENV:'production',TRON_NETWORK:'tron-mainnet',TRON_PROVIDER:'',TRANSACTIONS_ENABLED:'false',MANUAL_DEPOSIT_REVIEW:'true',AUTOMATED_BLOCKCHAIN_CREDIT:'false'});
 try {
  const db={query:async(sql,params)=>{assert.match(sql,/FROM ledger_balances/);assert.deepEqual(params,['user']);return {rows:[{asset_symbol:'USDT',bucket:'available',balance:'12.345678'},{asset_symbol:'INR',bucket:'payout_clearing',balance:'1200'}]};}};
  const service=new WalletsService(db,null);
  assert.deepEqual(await service.balance('user'),{availableUsdt:'12.345678',reservedUsdt:'0',pendingInr:'1200',source:'ledger',sandbox:false});
  db.query=async()=>({rows:[]});
  assert.deepEqual(await service.balance('user'),{availableUsdt:'0',reservedUsdt:'0',pendingInr:'0',source:'ledger',sandbox:false});
 }finally{for(const k of Object.keys(process.env))if(!(k in old))delete process.env[k];Object.assign(process.env,old);}
});

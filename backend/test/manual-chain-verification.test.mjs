import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyDepositOnChain } from '../dist/modules/manual/chain-verification.js';
import { assertManualChainReader } from '../dist/config/manual-chain-reader.js';

const evidence = {
  txHash:'a'.repeat(64), receiver:'receiver', sender:'sender', contract:'contract',
  verifiedAmount:'100', blockNumber:'100', blockHash:'b'.repeat(64),
  transactionTime:'2026-01-01T00:00:00.000Z',
};
const config = { provider:'tron-http',sandbox:false,network:'tron-mainnet',
  contract:'contract',confirmations:20 };
function fixture() {
  const transfer = { ...evidence, network:config.network, rawAmount:'100000000',
    decimals:6,eventIndex:7,timestamp:evidence.transactionTime,execution:'SUCCESS' };
  const transaction = {txHash:evidence.txHash,canonical:true,execution:'SUCCESS',transfers:[transfer]};
  return { transfer, transaction, provider: {
    getTransaction:async()=>transaction, getLatestBlock:async()=>119n,
    getBlockHash:async()=>evidence.blockHash,
  }};
}
test('independent verification retains actual log index and observed confirmations',async()=>{
  const f=fixture();
  const result=await verifyDepositOnChain(evidence,config,f.provider);
  assert.equal(result.eventIndex,7); assert.equal(result.confirmations,20);
  assert.equal(result.source,'tron-http');
});
for(const [name,change] of [
  ['missing transaction', f=>{f.provider.getTransaction=async()=>null;}],
  ['wrong transaction', f=>{f.transaction.txHash='c'.repeat(64);}],
  ['failed transaction', f=>{f.transaction.execution='FAILED';}],
  ['noncanonical transaction', f=>{f.transaction.canonical=false;}],
  ['wrong token', f=>{f.transfer.contract='other';}],
  ['wrong recipient', f=>{f.transfer.receiver='other';}],
  ['wrong network', f=>{f.transfer.network='tron-nile';}],
  ['wrong sender', f=>{f.transfer.sender='other';}],
  ['wrong amount', f=>{f.transfer.rawAmount='99999999';}],
  ['wrong decimals', f=>{f.transfer.decimals=18;}],
  ['failed transfer', f=>{f.transfer.execution='FAILED';}],
  ['wrong block', f=>{f.transfer.blockNumber='101';}],
  ['reorg', f=>{f.provider.getBlockHash=async()=>'c'.repeat(64);}],
  ['wrong timestamp', f=>{f.transfer.timestamp='2026-01-02T00:00:00Z';}],
  ['ambiguous transfers', f=>{f.transaction.transfers.push({...f.transfer,eventIndex:8});}],
  ['insufficient confirmations', f=>{f.provider.getLatestBlock=async()=>118n;}],
  ['future block', f=>{f.provider.getLatestBlock=async()=>99n;}],
  ['invalid event index', f=>{f.transfer.eventIndex=-1;}],
  ['RPC outage', f=>{f.provider.getTransaction=async()=>{throw Error('private upstream detail');};}],
]) test(`rejects ${name} without accepting operator assertions`,async()=>{
  const f=fixture();change(f);
  await assert.rejects(verifyDepositOnChain(evidence,config,f.provider));
});
test('a mock reader cannot satisfy the real-network verification boundary',async()=>{
  await assert.rejects(verifyDepositOnChain(evidence,{...config,sandbox:true},fixture().provider));
});
test('production manual credit requires a configured HTTPS reader; dormant intake does not',()=>{
  const env={NODE_ENV:'production',MANUAL_DEPOSIT_REVIEW:'true',TRANSACTIONS_ENABLED:'true'};
  for (const TRON_API_URL of [undefined,'http://rpc.invalid','https://localhost','https://user:password@rpc.invalid','https://rpc.invalid?key=secret']) {
    assert.throws(()=>assertManualChainReader({...env,TRON_PROVIDER:'tron-http',TRON_API_URL}),/MANUAL_CHAIN_READER_REQUIRED/);
  }
  assert.throws(()=>assertManualChainReader({...env,TRON_PROVIDER:'mock',TRON_API_URL:'https://rpc.invalid'}));
  assert.doesNotThrow(()=>assertManualChainReader({...env,TRON_PROVIDER:'tron-http',TRON_API_URL:'https://rpc.invalid'}));
  assert.doesNotThrow(()=>assertManualChainReader({...env,TRANSACTIONS_ENABLED:'false'}));
});

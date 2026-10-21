import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestDvConnectV1} from '../dist/modules/auth/dvconnect-otp.transport.js';
const delivery = () => ({challengeId:'test',destination:'+919876543210',channel:'sms',code:'654321',expiresAt:new Date(Date.now()+60000)});
async function fixture(fn) {
 const old = {...process.env}, fetch = globalThis.fetch;
 Object.assign(process.env,{OTP_PROVIDER:'dvconnect',DVCONNECT_API_KEY:'synthetic-&-key'});
 try {await fn();} finally {globalThis.fetch=fetch;for(const key of Object.keys(process.env))if(!(key in old))delete process.env[key];Object.assign(process.env,old);}
}
test('DV Connect v1 encodes the confirmed contract and does not interpret HTTP 200 as acceptance', async () => fixture(async () => {
 let count=0;
 globalThis.fetch=async (url, options) => {
  count++;
  assert.equal(url.origin+url.pathname,'https://otp.dvconnect.in/api-sms-v1.php');
  assert.deepEqual(Object.fromEntries(url.searchParams),{api_key:'synthetic-&-key',number:'9876543210',otp:'654321'});
  assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert.ok(options.signal);
  return new Response('Missing Parameters.');
 };
 assert.equal(await requestDvConnectV1(delivery()),'Missing Parameters.');
 assert.equal(count,1);
}));
test('DV Connect transport bounds responses, sanitizes failures and never retries',async () => fixture(async () => {
 for(const response of [() => new Response('upstream detail',{status:403}),()=>new Response('x'.repeat(8193)),()=>new Response(''),()=>{throw new Error('sensitive request URL');}]) {
  let count=0; globalThis.fetch=async()=>{count++;return response();};
  await assert.rejects(requestDvConnectV1(delivery()),e=>e.message==='SMS authentication unavailable');
  assert.equal(count,1);
 }
}));
test('DV Connect transport rejects invalid destinations, expired codes and missing credentials before sending',async () => fixture(async () => {
 let count=0;globalThis.fetch=async()=>{count++;throw new Error('unexpected request');};
 for(const change of [{channel:'email'},{destination:'+14155552671'},{destination:'+919876543210,9876543211'},{code:'bad'},{expiresAt:new Date(0)},{expiresAt:new Date('invalid')}])await assert.rejects(requestDvConnectV1({...delivery(),...change}));
 delete process.env.DVCONNECT_API_KEY;await assert.rejects(requestDvConnectV1(delivery()));assert.equal(count,0);
}));

test('DV Connect acceptance matches the observed live contract and rejects ambiguous errors',async()=>{
 const {dvConnectAccepted}=await import('../dist/modules/auth/dvconnect-otp.provider.js');
 assert.equal(dvConnectAccepted(JSON.stringify({return:true,request_id:42,message:['Message sent successfully']})),true);
 for(const value of [null,{}, {return:false,request_id:42,message:['Message sent successfully']},{return:'true',request_id:42,message:['Message sent successfully']},{return:true},{return:true,request_id:42,message:['Rejected']},{return:true,request_id:'42',message:['Message sent successfully']}])assert.equal(dvConnectAccepted(JSON.stringify(value)),false);
 assert.equal(dvConnectAccepted('Missing Parameters.'),false);
});
test('registered DV Connect provider rejects HTTP 200 errors and accepts the observed response',async()=>fixture(async()=>{
 const {DvConnectOtpProvider}=await import('../dist/modules/auth/dvconnect-otp.provider.js');
 const provider=new DvConnectOtpProvider();
 globalThis.fetch=async()=>Response.json({return:true,request_id:42,message:['Message sent successfully']});
 await provider.send(delivery());
 globalThis.fetch=async()=>new Response('Missing Parameters.');
 await assert.rejects(provider.send(delivery()),e=>e.message==='SMS authentication unavailable');
}));

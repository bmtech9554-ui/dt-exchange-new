import test from 'node:test';
import assert from 'node:assert/strict';
import { accessFromStatuses, discoverAdminAccess, moduleEndpoints } from '../src/lib/admin-access';
test('standard operations lands on manual reviews while dashboard stays denied',()=>{
 const a=accessFromStatuses([['dashboard',403],['orders',200],['manual-deposits',200],['android-releases',200],['reviews',200]]);
 assert.equal(a?.landing,'/manual-deposits');assert.ok(!a?.allowedModules.includes('dashboard'));assert.ok(a?.allowedModules.includes('android-releases'));
});
test('401 is session expiration; 403 remains authenticated even with no modules',()=>{
 assert.equal(accessFromStatuses([['manual-deposits',200],['dashboard',401]]),null);
 assert.equal(accessFromStatuses([['dashboard',403]])?.authenticated,true);
 assert.equal(accessFromStatuses([['dashboard',403]])?.landing,null);
});
test('outages cannot masquerade as successful authentication or permission grants',()=>{
 assert.throws(()=>accessFromStatuses([['dashboard',503]]));
 const a=accessFromStatuses([['dashboard',403],['manual-deposits',503]]);assert.deepEqual(a?.allowedModules,[]);assert.deepEqual(a?.unavailableModules,['manual-deposits']);
});
test('access discovery uses one authenticated capability read without records, grants or cached sessions',async()=>{
 let requests=0;
 const request:typeof fetch=async(input,init)=>{requests++;assert.equal(String(input),'https://test.invalid/api/v1/admin/access');assert.equal(init?.cache,'no-store');return Response.json({authenticated:true,permissions:['DEPOSIT_REVIEW','ANDROID_RELEASE_PUBLISH']});};
 const a=await discoverAdminAccess('https://test.invalid/api/v1','synthetic-session',request);
 assert.equal(requests,1);assert.deepEqual(a?.allowedModules,['manual-deposits','android-releases','notifications']);assert.equal(a?.landing,'/manual-deposits');assert.ok(!JSON.stringify(a).includes('synthetic-session'));
 const expired=await discoverAdminAccess('https://test.invalid/api/v1','synthetic-session',async()=>new Response(null,{status:401}));assert.equal(expired,null);
 await assert.rejects(discoverAdminAccess('https://test.invalid/api/v1','synthetic-session',async()=>new Response(null,{status:503})));
});

test("owner lands on permitted dashboard without changing restricted-role routing",()=>{assert.equal(accessFromStatuses([["manual-deposits",200],["dashboard",200]])?.landing,"/dashboard");});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {validTestRelease} from '../src/lib/public-test-release';
import {PublicTestConsole} from '../src/components/public-test-console';
const verified={applicationId:'com.dtexchange.dt_exchange.publictest',versionCode:8019,versionName:'1.0.0',publicTestMode:true,realMoney:false,debuggable:false,signatureVerified:true,physicalDeviceValidation:'PASSED',certificateSha256:'475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c',sha256:'a'.repeat(64),sizeBytes:60000000,apiBaseUrl:'https://dtexchange.app/test-api/api/v1',publishedAt:'2026-10-13T15:00:00Z'};
test('public test download fails closed for production identity, missing physical validation and wrong signer',()=>{
 assert(validTestRelease(verified));
 for(const patch of [{applicationId:'com.dtexchange.dt_exchange'},{realMoney:true},{debuggable:true},{physicalDeviceValidation:'PENDING'},{apiBaseUrl:'https://api.dtexchange.app/api/v1'},{certificateSha256:'b'.repeat(64)},{sha256:'bad'}])assert.equal(validTestRelease({...verified,...patch}),false);
});
test('test console starts with protected login, authenticator field and explicit simulation label',()=>{
 const html=renderToStaticMarkup(<PublicTestConsole/>);assert(html.includes('SIMULATION — NO REAL USDT OR INR'));assert(html.includes('Current authenticator code'));assert(html.includes('Test administrator sign in'));assert(!html.includes('Approve demo credit'));
});

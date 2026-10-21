import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validSimulationRelease} from '../src/lib/simulation-release';
const r={available:true,apkUrl:'https://dtexchange.app/downloads/DTExchange.apk',downloadUrl:'https://dtexchange.app/download',latestVersion:'1.0.0',latestVersionCode:8021,minimumVersionCode:8011,sizeBytes:60000000,sha256:'a'.repeat(64),certificateSha256:'475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c',releaseNotes:'Simulation only; no real money.',releaseDate:'2026-10-13T15:00:00Z',mandatory:false,applicationId:'com.dtexchange.dt_exchange',signatureVerified:true,debuggable:false,simulation:true,realMoney:false,physicalDeviceValidation:'PASSED',apiBaseUrl:'https://dtexchange.app/test-api/api/v1'};
test('normal simulation release requires original identity, isolated API and verified physical artifact',()=>{
 assert(validSimulationRelease(r));
 for(const patch of [{applicationId:'com.dtexchange.dt_exchange.publictest'},{realMoney:true},{simulation:false},{debuggable:true},{signatureVerified:false},{physicalDeviceValidation:'PENDING'},{apiBaseUrl:'https://api.dtexchange.app/api/v1'},{certificateSha256:'b'.repeat(64)},{apkUrl:'https://example.com/demo.apk'}])assert.equal(validSimulationRelease({...r,...patch}),false);
});

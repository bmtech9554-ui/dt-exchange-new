import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {loggingHealthProjection,localLoggingHealth}=require('../dist/common/local-logging-health');
test('owner health only projects fresh allowlisted technical metadata',()=>{
 const now=Date.now();
 const r=loggingHealthProjection({status:'healthy',checkedAt:now/1000,codes:[],retentionDays:180,
  archiveBytes:1024,diskFreeBytes:999999,indiaStorageVerified:true,password:'SECRET',identityFile:'SECRET'},now);
 assert.equal(r.status,'healthy');assert.equal(r.indiaStorageVerified,false);
 assert.equal(JSON.stringify(r).includes('SECRET'),false);
 assert.equal(r.archiveBytes,1024);
});
test('stale or malicious health report never leaks payloads or appears healthy',async()=>{
 const now=Date.now();
 assert.equal(loggingHealthProjection({checkedAt:now/1000-301},now).status,'stale');
 assert.equal(loggingHealthProjection({checkedAt:Infinity},now).status,'stale');
 const r=loggingHealthProjection({checkedAt:now/1000,status:'attention',codes:['ARCHIVE_STALE','SECRET'],
  archiveBytes:'SECRET',lastArchiveAt:Infinity},now);
 assert.deepEqual(r.codes,['ARCHIVE_STALE']);assert.equal(JSON.stringify(r).includes('SECRET'),false);
 assert.equal((await localLoggingHealth(undefined)).status,'not_reported');
});

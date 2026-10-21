import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url);
const {page,sanitize}=require('../../deployment/cloudzy/logging/local-records.cjs');
const {deliver}=require('../../deployment/cloudzy/logging/local-alert.cjs');
let db;
before(async()=>{db=new PGlite();for(const f of(await readdir(new URL('../migrations/',import.meta.url))).sort())
 await db.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 await db.exec(`INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes,created_at)
 SELECT 'service','synthetic-only','manual.transition','manual','synthetic-only',gen_random_uuid(),
 '{"password":"DO_NOT_CAPTURE_SYNTHETIC_SECRET"}'::jsonb,now()-interval '10 minutes' FROM generate_series(1,501)`);
});
after(async()=>db?.close());
test('fixed projection excludes free-form payloads and credentials',async()=>{
 const result=await page(db,{});
 assert.equal(result.records.length,500);
 assert.equal(result.cursor.audit_logs.done,false);
 assert.equal(JSON.stringify(result).includes('DO_NOT_CAPTURE'),false);
 assert.equal(result.records[0].action,'manual.transition');
 const next=await page(db,result.cursor);
 assert.equal(next.records.length,1);
 assert.equal(next.cursor.audit_logs.done,true);
 assert.ok(next.cursor.completedAt);
 assert.equal((await page(db,next.cursor)).records.length,0);
 assert.equal(new Set([...result.records,...next.records].map(r=>r.id)).size,501);
});
test('unknown action and non-UUID identifiers are suppressed',()=>{
 const safe=sanitize('audit_logs',{id:randomUUID(),actor_type:'password',actor_id:'SECRET_TOKEN',
  entity_id:'SECRET_TOKEN',request_id:'SECRET_TOKEN',action:'SECRET_TOKEN',from_status:'SECRET_TOKEN',to_status:'UNDER_REVIEW'});
 assert.equal(JSON.stringify(safe).includes('SECRET_TOKEN'),false);
 assert.equal(safe.actorType,'unknown');assert.equal(safe.actorId,null);
 assert.equal(safe.fromStatus,null);assert.equal(safe.toStatus,'UNDER_REVIEW');
});
test('local alert is idempotent, immutable and restricted to existing monitoring permission',async()=>{
 await deliver(db,['ARCHIVE_STALE','DISK_CAPACITY_LOW'],100);
 await deliver(db,['DISK_CAPACITY_LOW','ARCHIVE_STALE'],100);
 const n=await db.query('SELECT permission_code,title,target FROM admin_event_notifications');
 assert.equal(n.rows.length,1);
 assert.deepEqual(n.rows[0],{permission_code:'system.monitor',title:'System Health',target:'/health'});
 const audit=await db.query("SELECT sanitized_changes FROM audit_logs WHERE action='security.monitor.alert'");
 assert.equal(audit.rows.length,1);assert.equal(audit.rows[0].sanitized_changes.financialMutation,false);
 for(const table of ['ledger_journals','ledger_entries','payouts','sell_orders','manual_deposit_requests'])
  assert.equal((await db.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,0);
 assert.equal((await db.query('SELECT count(*)::int n FROM admin_user_roles')).rows[0].n,0);
 await assert.rejects(db.query("UPDATE admin_event_notifications SET title='changed'"));
});
test('arbitrary alert payloads or financial actions cannot be sent',async()=>{
 for(const codes of [['token=SECRET'],['PAYOUT_APPROVE'],[],Array(31).fill('API_NOT_READY')])
  await assert.rejects(deliver(db,codes,100));
 await assert.rejects(deliver(db,['API_NOT_READY'],'not-a-bucket'));
 assert.equal((await db.query('SELECT count(*)::int n FROM admin_event_notifications')).rows[0].n,1);
});

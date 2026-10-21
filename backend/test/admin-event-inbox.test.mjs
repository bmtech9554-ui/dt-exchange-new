import 'reflect-metadata';
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {AdminInbox} from '../dist/modules/owner/admin-inbox.js';
let db,inbox,reviewer,other,uid,id;
before(async()=>{db=new PGlite();for(const f of(await readdir(new URL('../migrations/',import.meta.url))).sort())await db.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const adapter={query:(...a)=>db.query(...a),transaction:fn=>db.transaction(fn)};inbox=new AdminInbox(adapter);
 reviewer=randomUUID();other=randomUUID();for(const actor of[reviewer,other])await db.query("INSERT INTO admin_users(id,email_lookup_hash,email_ciphertext,password_hash,status) VALUES($1::uuid,$1::text,'\\x00','test-only','active')",[actor]);
 const role=(await db.query("INSERT INTO admin_roles(name,description) VALUES('TEST_DEPOSIT_READER','Isolated notification permission test') RETURNING id")).rows[0].id;await db.query("INSERT INTO admin_role_permissions(role_id,permission_code) VALUES($1,'DEPOSIT_REVIEW')",[role]);await db.query('INSERT INTO admin_user_roles(admin_user_id,role_id) VALUES($1,$2)',[reviewer,role]);
 uid=randomUUID();await db.query("INSERT INTO users(id,email_lookup_hash,email_ciphertext,status,terms_version,terms_accepted_at) VALUES($1::uuid,$1::text,'\\x00','active','test',now())",[uid]);
 await db.query("INSERT INTO manual_deposit_requests(user_id,network_code,tx_hash,submitted_amount,receiver,status) VALUES($1,'TRC20',$2,100,'synthetic-fixture','UNDER_REVIEW')",[uid,'f'.repeat(64)]);
 id=(await inbox.list(reviewer)).items[0].id;
});after(async()=>db?.close());
test('committed operational event creates one permission-filtered, private notification',async()=>{
 const r=await inbox.list(reviewer);assert.equal(r.items.length,1);assert.equal(r.unread,'1');assert.match(r.items[0].target,/^\/manual-deposits\?id=/);
 assert.equal((await inbox.list(other)).items.length,0);await assert.rejects(inbox.mark(other,id,true));
 await assert.rejects(db.query("UPDATE admin_event_notifications SET title='tampered'"));
 await assert.rejects(db.query("INSERT INTO admin_event_notifications(event_key,permission_code,title,entity_id,target) SELECT event_key,permission_code,title,entity_id,target FROM admin_event_notifications"));
});
test('read/unread is idempotent and scoped to the admin without affecting financial data',async()=>{
 await inbox.mark(reviewer,id,true);await inbox.mark(reviewer,id,true);assert.equal((await inbox.list(reviewer)).unread,'0');
 await inbox.mark(reviewer,id,false);assert.equal((await inbox.list(reviewer)).unread,'1');
 assert.equal((await db.query('SELECT count(*)::int n FROM ledger_journals')).rows[0].n,0);
 await assert.rejects(inbox.mark(reviewer,'1 OR 1=1',true));await assert.rejects(inbox.list(reviewer,0));
 await db.query("UPDATE admin_users SET status='suspended' WHERE id=$1",[reviewer]);assert.equal((await inbox.list(reviewer)).items.length,0);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

test('public IDs backfill chronologically, serialize allocations, remain immutable and are never reused',async()=>{
 const db=process.env.PHASE6_POSTGRES_URL ? await (await import('./postgres-harness.mjs')).realDatabase() : new PGlite();
 try {
  const files=(await readdir(new URL('../migrations/',import.meta.url))).sort();
  for(const f of files.filter(f=>f<'017')) await db.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
  const older=randomUUID(),newer=randomUUID();
  const insert=(id,date)=>db.query("INSERT INTO users(id,email_lookup_hash,email_ciphertext,status,terms_version,terms_accepted_at,created_at) VALUES($1,$3,'\\x00','active','test',now(),$2) RETURNING id",[id,date,id]);
  await insert(newer,'2026-10-02'); await insert(older,'2026-10-01');
  await db.exec('BEGIN;'+await readFile(new URL('../migrations/017_public_user_ids.sql',import.meta.url),'utf8')+';COMMIT;');
  assert.deepEqual((await db.query('SELECT id,public_user_id::text n FROM users ORDER BY public_user_id')).rows,[{id:older,n:'1000'},{id:newer,n:'1001'}]);
  await Promise.all(Array.from({length:40},()=>insert(randomUUID(),'2026-10-03')));
  const all=(await db.query('SELECT public_user_id::text n FROM users ORDER BY public_user_id')).rows.map(r=>r.n);
  assert.equal(new Set(all).size,42);assert.equal(all.at(-1),'1041');
  await assert.rejects(db.query('UPDATE users SET public_user_id=9000 WHERE id=$1',[older]));
  await assert.rejects(db.query("INSERT INTO users(public_user_id,status,terms_version,terms_accepted_at) VALUES(9000,'active','test',now())"));
  await db.query('DELETE FROM users WHERE id=$1',[newer]);
  const id=randomUUID();await insert(id,'2026-10-04');
  assert.equal((await db.query('SELECT public_user_id::text n FROM users WHERE id=$1',[id])).rows[0].n,'1042');
 } finally {await db.close();}
});

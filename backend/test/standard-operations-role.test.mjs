import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
test('migration-only production has a standard operations role with exactly its canonical grants',async()=>{
 const db=new PGlite();
 try {
  const dir=new URL('../migrations/',import.meta.url);
  for(const name of (await readdir(dir)).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile(new URL(name,dir),'utf8'));
  const sql=await readFile(new URL('010_standard_operations_role.sql',dir),'utf8');await db.exec(sql);
  assert.deepEqual((await db.query("SELECT p.permission_code FROM admin_role_permissions p JOIN admin_roles r ON r.id=p.role_id WHERE r.name='operations' ORDER BY p.permission_code")).rows.map(x=>x.permission_code),['deposits.read','orders.read','reviews.acknowledge','reviews.read']);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM admin_roles WHERE name='operations'")).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM admin_users')).rows[0].n,0);
 }finally{await db.close();}
});

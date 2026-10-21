import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {CryptoService} from '../dist/common/crypto.service.js';

test('official provisioner commits standard operations with valid audit actor and rolls back duplicate attempts',async()=>{
 const db=new PGlite();
 const previous={DATA_ENCRYPTION_KEY:process.env.DATA_ENCRYPTION_KEY,LOOKUP_HASH_KEY:process.env.LOOKUP_HASH_KEY};
 Object.assign(process.env,{DATA_ENCRYPTION_KEY:randomBytes(32).toString('base64'),LOOKUP_HASH_KEY:randomBytes(32).toString('base64')});
 try {
  const dir=new URL('../migrations/',import.meta.url);
  for(const name of (await readdir(dir)).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile(new URL(name,dir),'utf8'));
  // Execute the actual CLI body with an isolated PostgreSQL-compatible client;
  // only imports and process/console boundaries are substituted.
  const source=(await readFile(new URL('../scripts/provision-admin.mjs',import.meta.url),'utf8'))
   .replace(/^import .*;\r?\n/gm,'');
  const run=new (Object.getPrototypeOf(async function(){}).constructor)('pg','randomUUID','CryptoService','process','console',source);
  const pg={Client:class{async connect(){} query(...args){return db.query(...args).then(r=>({...r,rowCount:r.affectedRows??r.rows.length}));}async end(){}}};
  const state={env:{ADMIN_EMAIL:'synthetic@example.invalid',ADMIN_PASSWORD:randomBytes(24).toString('hex'),ADMIN_TOTP_SECRET:randomBytes(20).toString('hex').toUpperCase().replace(/[0189]/g,'A'),DATABASE_URL:'isolated-test',NODE_ENV:'production',ADMIN_ROLE:'operations'},exitCode:0};
  // Use valid base32 synthetic enrollment material, unrelated to production.
  state.env.ADMIN_TOTP_SECRET='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const quiet={log(){},error(){}};
  await run(pg,randomUUID,CryptoService,state,quiet);
  assert.equal(state.exitCode,0);
  const account=(await db.query('SELECT id,password_hash,totp_secret_ciphertext FROM admin_users')).rows;
  assert.equal(account.length,1);
  const crypto=new CryptoService();
  assert.equal(await crypto.verifyPassword(state.env.ADMIN_PASSWORD,account[0].password_hash),true);
  assert.equal(crypto.decrypt(account[0].totp_secret_ciphertext,'admin-totp:'+account[0].id),state.env.ADMIN_TOTP_SECRET);
  assert.deepEqual((await db.query('SELECT r.name FROM admin_user_roles ur JOIN admin_roles r ON r.id=ur.role_id')).rows,[{name:'operations'}]);
  assert.deepEqual((await db.query("SELECT actor_type,actor_id,sanitized_changes FROM audit_logs WHERE action='admin.provisioned'")).rows,[{actor_type:'service',actor_id:'secure-provisioner',sanitized_changes:{role:'operations'}}]);
  await run(pg,randomUUID,CryptoService,state,quiet);
  assert.equal(state.exitCode,1);
  assert.equal((await db.query('SELECT count(*)::int n FROM admin_users')).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int n FROM admin_user_roles')).rows[0].n,1);
  assert.equal((await db.query("SELECT count(*)::int n FROM audit_logs WHERE action='admin.provisioned'")).rows[0].n,1);
 }finally{
  for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  await db.close();
 }
});

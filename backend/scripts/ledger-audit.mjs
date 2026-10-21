import pg from 'pg';
import {readFile} from 'node:fs/promises';
const db=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000,statement_timeout:30000});
try{await db.connect();await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const sql=await readFile(new URL('../operations/ledger-integrity.sql',import.meta.url),'utf8');const results=await db.query(sql);const issues=results.flatMap(r=>r.rows);await db.query('COMMIT');console.log(JSON.stringify({checkedAt:new Date().toISOString(),issueCount:issues.length,issues}));if(issues.length)process.exitCode=2;}catch{console.error(JSON.stringify({result:'AUDIT_UNAVAILABLE'}));process.exitCode=1;}finally{await db.end();}

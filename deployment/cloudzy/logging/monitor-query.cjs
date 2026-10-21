// Read-only, aggregate monitoring. No user, bank, credential or proof payload.
const fs = require('node:fs');
const { Client } = require('/app/node_modules/pg');
const db = new Client({connectionString:fs.readFileSync(process.env.DATABASE_URL_FILE,'utf8').trim()});
(async()=>{
 await db.connect(); await db.query('BEGIN READ ONLY');
 const result={};
 result.failedLogins15m=(await db.query("SELECT count(*)::int n FROM login_history WHERE NOT success AND created_at>now()-interval '15 minutes'")).rows[0].n;
 result.openHighRisk=(await db.query("SELECT count(*)::int n FROM risk_flags WHERE state<>'resolved' AND severity IN ('high','critical')")).rows[0].n;
 result.ledgerIntegrityIssues=(await db.query('SELECT count(*)::int n FROM ledger_integrity_issues')).rows[0].n;
 result.referralsHeld=(await db.query('SELECT count(*)::int n FROM referrals WHERE review_required')).rows[0].n;
 result.workerCurrent=(await db.query("SELECT count(*)::int n FROM worker_heartbeats WHERE worker='engagement' AND state='ok' AND last_seen_at>now()-interval '2 minutes'")).rows[0].n===1;
 result.automationDisabled=process.env.AUTOMATED_BLOCKCHAIN_CREDIT==='false' && process.env.AUTOMATED_PAYOUT==='false';
 await db.query('COMMIT'); process.stdout.write(JSON.stringify(result));
})().catch(()=>{process.exitCode=1}).finally(()=>db.end());

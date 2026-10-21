// Run only inside the existing API container via stdin. Its stdout MUST pipe
// directly into the encrypting collector, never a terminal or application log.
const fs = require('node:fs');
const { Client } = require('/app/node_modules/pg');
const db = new Client({ connectionString: fs.readFileSync(process.env.DATABASE_URL_FILE, 'utf8').trim() });
(async () => {
  await db.connect();
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const result = {};
  // Exclude credentials, OTP challenges, session tokens, bank ciphertext and
  // private-file bytes. Financial transaction reconstruction uses DB backups.
  for (const table of ['audit_logs', 'login_history', 'risk_flags']) {
    const rows = (await db.query(`SELECT * FROM ${table} ORDER BY created_at,id LIMIT 100001`)).rows;
    if (rows.length > 100000) throw new Error('EXPORT_PARTITIONING_REQUIRED');
    result[table] = rows;
  }
  result.collectedAt = (await db.query('SELECT now() AS time')).rows[0].time;
  await db.query('COMMIT');
  process.stdout.write(JSON.stringify(result));
})().catch(() => { process.exitCode = 1; }).finally(() => db.end());

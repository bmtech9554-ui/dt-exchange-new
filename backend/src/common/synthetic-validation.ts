import { SqlClient } from './database.service';
/** Owner-authorized, expiring physical validation. Never grants financial execution. */
export async function syntheticValidation(tx: SqlClient, uid?: string): Promise<boolean> {
  if (!uid || process.env.MANUAL_DEPOSIT_REVIEW !== 'true' || process.env.MANUAL_PAYOUT !== 'true' || process.env.AUTOMATED_BLOCKCHAIN_CREDIT !== 'false' || process.env.AUTOMATED_PAYOUT !== 'false' || process.env.TRANSACTIONS_ENABLED !== 'false' || process.env.PAYOUTS_ENABLED !== 'false') return false;
  return (await tx.query(`SELECT 1 FROM system_settings WHERE key='synthetic_device_validation' AND value->>'userId'=$1 AND value->>'enabled'='true' AND (value->>'expiresAt')::timestamptz>now() AND EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='aa_protect_synthetic_deposit' AND tgenabled='O') AND EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='prohibit_synthetic_order' AND tgenabled='O') AND EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='prohibit_synthetic_payout' AND tgenabled='O')`,[uid])).rows.length===1;
}
export const SYNTHETIC_BANK_PROVIDER='synthetic-nonpayable';

/** Only non-financial validation writes from the owner-approved device build. */
export async function syntheticBuildWrite(tx: SqlClient, uid: string, method: string, path: string, code?: string): Promise<boolean> {
  const route=(method==='POST' && ['/api/v1/manual/deposits','/api/v1/sell/quote'].includes(path)) || (method==='DELETE' && /^\/api\/v1\/sell\/quote\/[0-9a-f-]{36}$/.test(path));
  if (!route || !/^\d{1,10}$/.test(code??'') || !(await syntheticValidation(tx,uid))) return false;
  return (await tx.query("SELECT 1 FROM system_settings WHERE key='synthetic_device_validation' AND value->>'androidVersionCode'=$1",[code])).rows.length===1;
}

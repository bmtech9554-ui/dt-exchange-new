import { ServiceUnavailableException } from '@nestjs/common';
import { SqlClient } from './database.service';
import { syntheticValidation } from './synthetic-validation';

// Deployment opt-in only. Expiry closes access; it never returns to ordinary service.
export function privateBetaEnabled(source: NodeJS.ProcessEnv = process.env): boolean {
  return source.PRIVATE_BETA_MODE !== undefined && source.PRIVATE_BETA_MODE !== '' && source.PRIVATE_BETA_MODE !== 'false';
}

export function assertPrivateBeta(source: NodeJS.ProcessEnv = process.env): void {
  if (!privateBetaEnabled(source)) return;
  if (source.PRIVATE_BETA_MODE !== 'true') throw new Error('INVALID_PRIVATE_BETA_MODE');
  const required: Record<string, string> = {
    MANUAL_DEPOSIT_REVIEW: 'true', MANUAL_PAYOUT: 'true',
    AUTOMATED_BLOCKCHAIN_CREDIT: 'false', AUTOMATED_PAYOUT: 'false',
    TRANSACTIONS_ENABLED: 'false', PAYOUTS_ENABLED: 'false',
    MANUAL_DEPOSIT_SUBMISSIONS_ENABLED: 'false', REFERRAL_PROGRAM_PAUSED: 'true',
  };
  if (Object.entries(required).some(([name, value]) => source[name] !== value))
    throw new Error('PRIVATE_BETA_REQUIRES_FINANCIAL_EXECUTION_AND_NORMAL_INTAKE_DISABLED');
}

// This is intentionally not a valid TRON address. Build 8017 already labels
// sandbox addresses and QR codes as non-payable; no APK/content change is needed.
export const PRIVATE_BETA_ADDRESS = 'DT-SYNTHETIC-NONPAYABLE';

export async function requirePrivateBetaAccount(tx: SqlClient, uid?: string, build?: string): Promise<void> {
  if (!privateBetaEnabled()) return;
  assertPrivateBeta();
  if (!(await syntheticValidation(tx, uid))) throw new ServiceUnavailableException();
  const value = (await tx.query("SELECT value FROM system_settings WHERE key='synthetic_device_validation'")).rows[0]?.value;
  const now = Date.now(), start = Date.parse(value?.startedAt ?? ''), end = Date.parse(value?.expiresAt ?? '');
  if (value?.userId !== uid || value?.enabled !== true || !Number.isFinite(start) || !Number.isFinite(end) ||
      start > now || end <= now || end <= start || end - start > 3600000 ||
      !/^[1-9][0-9]{0,9}$/.test(String(value?.androidVersionCode ?? '')) ||
      (build !== undefined && build !== String(value.androidVersionCode)))
    throw new ServiceUnavailableException();
}

export function privateBetaWriteAllowed(method: string, path: string): boolean {
  if (['GET', 'HEAD'].includes(method)) return true;
  if (method === 'POST' && [
    '/api/v1/manual/files', '/api/v1/manual/deposits', '/api/v1/sell/quote',
    '/api/v1/bank-accounts', '/api/v1/auth/logout', '/api/v1/auth/logout-all',
  ].includes(path)) return true;
  return (method === 'POST' && /^\/api\/v1\/manual\/deposits\/[0-9a-f-]{36}\/resubmit$/.test(path)) ||
    (method === 'DELETE' && /^\/api\/v1\/sell\/quote\/[0-9a-f-]{36}$/.test(path));
}

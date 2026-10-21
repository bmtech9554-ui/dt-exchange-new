import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const codes = new Set(['API_NOT_READY','WORKER_STALE','CLOCK_UNSYNCED','AUTOMATION_FLAG_DRIFT',
 'LEDGER_INTEGRITY_REVIEW','AUTH_FAILURE_BURST','OPEN_HIGH_RISK_REVIEW','REFERRAL_REVIEW_PENDING',
 'BACKUP_STALE','ARCHIVE_STALE','DISK_CAPACITY_LOW','DOCKER_CAPTURE_HEADROOM_LOW',
 'ARCHIVE_BUDGET_WARNING','ARCHIVE_CAPTURE_GAP','ARCHIVE_BACKLOG','ARCHIVE_INTEGRITY_FAILED',
 'LOGGING_SERVICE_FAILED','SSH_SECURITY_SERVICE_FAILED','MONITOR_EXECUTION_FAILED',
 'ADMIN_AUTH_FAILURE_BURST','SSH_AUTH_FAILURE_BURST','DEPOSIT_CONFLICT_BURST']);

export function loggingHealthProjection(input: unknown, now = Date.now()) {
  if (!input || typeof input !== 'object') return { status: 'not_reported' };
  const value = input as Record<string, unknown>;
  if (typeof value.checkedAt !== 'number' || !Number.isFinite(value.checkedAt) ||
      value.checkedAt > now / 1000 + 60 || value.checkedAt < now / 1000 - 300)
    return { status: 'stale' };
  const selected = Array.isArray(value.codes) ? value.codes.filter((c): c is string => typeof c === 'string' && codes.has(c)) : [];
  const result: Record<string, unknown> = {
    status: value.status === 'healthy' && selected.length === 0 ? 'healthy' : 'attention',
    checkedAt: new Date(value.checkedAt * 1000).toISOString(), codes: selected.slice(0, 30),
    deliveryPending: value.deliveryPending === true, indiaStorageVerified: false,
  };
  for (const key of ['retentionDays', 'archiveBytes', 'diskFreeBytes'])
    if (typeof value[key] === 'number' && Number.isSafeInteger(value[key]) && value[key] >= 0) result[key] = value[key];
  if (typeof value.lastArchiveAt === 'number' && Number.isFinite(value.lastArchiveAt) &&
      value.lastArchiveAt > 0 && value.lastArchiveAt <= now / 1000 + 60)
    result.lastArchiveAt = new Date(value.lastArchiveAt * 1000).toISOString();
  return result;
}

export async function localLoggingHealth(existingHealthFile: string | undefined) {
  if (!existingHealthFile) return { status: 'not_reported' };
  try {
    const data = await readFile(join(dirname(existingHealthFile), 'logging-health.json'), 'utf8');
    if (data.length > 16384) return { status: 'unavailable' };
    return loggingHealthProjection(JSON.parse(data));
  } catch { return { status: 'not_reported' }; }
}

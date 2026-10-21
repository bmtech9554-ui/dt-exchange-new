import { safePublicHttps } from './setup-report.js';
import { createPrivateKey, createPublicKey } from 'node:crypto';
/** Additional RC checks. Never log supplied configuration or key material. */
export function assertReleaseSecurity(s: NodeJS.ProcessEnv, manual = false) {
  for (const name of ['DEBUG','API_DEBUG','ADMIN_DEBUG','DEMO_MODE','ALLOW_TEST_ENDPOINTS'])
    if (s[name] && !['false','0'].includes(s[name]!.toLowerCase())) throw new Error('DEBUG_CONFIGURATION_FORBIDDEN');
  if (s.NODE_OPTIONS && /--inspect/.test(s.NODE_OPTIONS)) throw new Error('DEBUG_CONFIGURATION_FORBIDDEN');
  try {
    const priv = createPrivateKey(Buffer.from(s.JWT_PRIVATE_KEY_B64!, 'base64'));
    const pub = createPublicKey(Buffer.from(s.JWT_PUBLIC_KEY_B64!, 'base64'));
    if (priv.asymmetricKeyType !== 'rsa' || pub.asymmetricKeyType !== 'rsa' ||
      (priv.asymmetricKeyDetails?.modulusLength ?? 0) < 2048 ||
      !createPublicKey(priv).export({type:'spki',format:'der'}).equals(pub.export({type:'spki',format:'der'}))) throw new Error();
  } catch { throw new Error('INVALID_OR_WEAK_JWT_KEY_PAIR'); }
  for (const name of ['DATABASE_URL','REDIS_URL']) {
    let u: URL; try {u=new URL(s[name]!);} catch {throw new Error('INVALID_SERVICE_URL');}
    const password=decodeURIComponent(u.password);
    if (!u.username || password.length < 16 || /^(password|placeholder|changeme|postgres|redis|admin|default|replace)/i.test(password))
      throw new Error('DEFAULT_OR_WEAK_SERVICE_CREDENTIALS');
  }
  for (const name of ['ADMIN_BOOTSTRAP_PASSWORD','PAYOUT_API_KEY','PAYOUT_API_SECRET','PAYOUT_WEBHOOK_SECRET']) {
    if (manual && name.startsWith("PAYOUT_")) continue;
    const value=s[name];
    if (name.startsWith('PAYOUT_') && !value) throw new Error('PAYOUT_CREDENTIALS_REQUIRED');
    if (value && (value.length < 24 || /^(password|placeholder|changeme|admin|default|replace)/i.test(value))) throw new Error('DEFAULT_OR_WEAK_PROVIDER_CREDENTIALS');
  }
  for (const name of ['TRON_API_URL','PAYOUT_API_URL']) {
    if (manual) continue;
    let u: URL;try {u=new URL(s[name]!);}catch {throw new Error('HTTPS_PROVIDER_URL_REQUIRED');}
    if(!safePublicHttps(s[name]!)) throw new Error('HTTPS_PROVIDER_URL_REQUIRED');
  }
  if (manual && s.TRANSACTIONS_ENABLED !== "true" && s.PAYOUTS_ENABLED !== "true") return;
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(s.TRON_USDT_CONTRACT ?? '')) throw new Error('INVALID_TRON_CONTRACT');
  const confirmations=s.TRON_REQUIRED_CONFIRMATIONS ?? '';
  if (!/^[1-9][0-9]*$/.test(confirmations) || Number(confirmations)>10000) throw new Error('INVALID_CONFIRMATION_THRESHOLD');
}

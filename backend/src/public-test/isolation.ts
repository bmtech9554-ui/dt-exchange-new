/** This entry point is deployed only in the separate, egress-denied test stack. */
export const TEST_ADDRESS = 'DT-TEST-NONPAYABLE-NO-REAL-USDT';
export const TEST_LABEL = 'SIMULATION — NO REAL USDT OR INR';
export function assertPublicTestIsolation(env: NodeJS.ProcessEnv = process.env) {
  if (env.PUBLIC_TEST_MODE !== 'true' || env.NODE_ENV !== 'test') throw new Error('PUBLIC_TEST_MODE_REQUIRED');
  const db = new URL(env.DATABASE_URL ?? 'invalid:');
  if (!['test-db', '127.0.0.1', 'localhost'].includes(db.hostname) || db.pathname !== '/dtexchange_public_test') throw new Error('PUBLIC_TEST_DATABASE_REQUIRED');
  if (env.REDIS_URL || env.DVCONNECT_API_KEY || env.DVCONNECT_API_KEY_FILE || env.TRON_RPC_URL || env.PAYOUT_API_KEY) throw new Error('PUBLIC_TEST_EXTERNAL_PROVIDER_FORBIDDEN');
  const required: Record<string,string> = {
    TRON_PROVIDER:'mock', TRON_NETWORK:'tron-mock', OTP_PROVIDER:'dev',
    VERIFICATION_PROVIDER:'mock', RATE_PROVIDER:'mock', PAYOUT_PROVIDER:'mock',
    MANUAL_DEPOSIT_REVIEW:'true', MANUAL_PAYOUT:'true',
    AUTOMATED_BLOCKCHAIN_CREDIT:'false', AUTOMATED_PAYOUT:'false',
    REFERRAL_PROGRAM_PAUSED:'true', MANUAL_COLLECTION_ADDRESS:TEST_ADDRESS,
    PAYOUT_MAX_AMOUNT:'51500000', PUBLIC_TEST_REAL_MONEY:'false',
    OWNER_WALLET_ADJUSTMENTS_ENABLED:'false', REFERRAL_REWARD_RELEASE_ENABLED:'false',
  };
  for(const [key,value] of Object.entries(required)) if(env[key] !== value) throw new Error('PUBLIC_TEST_CONFIG_INVALID_'+key);
}

// No generic OTP/reset, real bank input, on-chain address allocation, owner settings,
// release publication, callbacks, fixture controls, or provider operations are exposed.
export function publicTestRouteAllowed(method:string, path:string) {
  if (method === 'OPTIONS') return true;
  const p=path.replace(/^\/api\/v1/,'');
  if(method==='POST' && /^(\/test\/(register-challenge|verify)|\/test\/admin\/users\/[\w-]+\/status|\/settings\/pin(?:\/verify)?)$/.test(p))return true;
  if(method==='POST' && /^\/support\/tickets(?:\/[\w-]+\/(replies|close))?$/.test(p))return true;
  if(method==='GET' && /^(\/rates\/usdt-inr|\/settings|\/sessions|\/(?:sell\/)?orders\/[\w-]+|\/admin\/(access|orders(?:\/[\w-]+)?))$/.test(p)) return true;
  if(method==='PATCH' && /^(\/settings\/preferences|\/notifications\/(preferences|[\w-]+\/read))$/.test(p)) return true;
  if(method==='DELETE' && /^(\/sell\/quote\/[\w-]+|\/sessions\/[\w-]+)$/.test(p)) return true;
  if(method==='POST' && /^(\/notifications\/read-all|\/sessions\/logout-others|\/settings\/delete-account)$/.test(p)) return true;
  if (method === 'GET') return /^(\/health(?:\/live|\/ready)?|\/test\/status|\/users\/me|\/wallet(?:\/summary)?|\/wallets(?:\/summary)?|\/rates(?:\/USDT-INR)?|\/bank-accounts(?:\/[\w-]+)?|\/history(?:\/[\w-]+)?|\/manual\/(configuration|deposits(?:\/[\w-]+)?|files\/[\w-]+)|\/app\/(configuration|terms|version\/android)|\/notifications(?:\/[\w-]+)?|\/referrals(?:\/.*)?|\/support(?:\/.*)?|\/auth\/sessions|\/admin\/(session|me|manual\/(dashboard|deposits(?:\/[\w-]+)?|payouts(?:\/[\w-]+)?|files\/[\w-]+)|owner\/(notifications(?:\/.*)?|orders(?:\/[\w-]+)?|users(?:\/[\w-]+)?)))$/.test(p);
  if (method === 'POST') return /^(\/test\/(register|login|bank|reference)|\/test\/admin\/(deposits\/[\w-]+\/approve|payouts\/[\w-]+\/simulate)|\/auth\/(refresh|logout|logout-all|change-password)|\/manual\/(files|deposits)|\/sell\/(quote|orders)|\/admin\/(login|logout|step-up|manual\/(files|deposits\/[\w-]+\/review|orders\/[\w-]+\/review|payouts\/[\w-]+\/(process|review|beneficiary))|owner\/notifications(?:\/.*)?))$/.test(p);
  return false;
}

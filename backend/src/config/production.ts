import { assertManualCapabilities } from "./manual-capabilities";
import { assertManualChainReader } from "./manual-chain-reader";
import { assertPrivateBeta } from '../common/private-beta';
import { assertManualMode } from './manual-mode';
import { validTronAddress } from '../modules/blockchain/tron-address';
import { assertReleaseSecurity } from './release-security.js';
/** Capabilities must reflect registered code, never a vendor name supplied through env. */
export function assertProduction(source: NodeJS.ProcessEnv = process.env) {
  assertPrivateBeta(source);
  assertManualMode(source);
  const manual = source.MANUAL_DEPOSIT_REVIEW === "true" && source.MANUAL_PAYOUT === "true";
  if (source.APP_ENV && !["development", "staging", "production"].includes(source.APP_ENV))
    throw new Error("INVALID_APP_ENV");
  if (source.APP_ENV && source.DEPLOYMENT_ENV && source.APP_ENV !== source.DEPLOYMENT_ENV)
    throw new Error("CONFLICTING_DEPLOYMENT_ENV");
  const deployment = source.APP_ENV ?? source.DEPLOYMENT_ENV ?? source.NODE_ENV ?? "development";
  if (!["development", "test", "staging", "production"].includes(deployment))
    throw new Error("INVALID_DEPLOYMENT_ENV");
  if (deployment === "production" && source.NODE_ENV !== "production")
    throw new Error("PRODUCTION_RUNTIME_REQUIRED");
  if (source.NODE_ENV !== "production") return;
  if (source.MOCK_PROVIDER === "true" || source.DEV_OTP_EXPOSE === "true")
    throw new Error("MOCK_PROVIDER_FORBIDDEN");
  for (const name of [
    "DATABASE_URL",
    "REDIS_URL",
    "JWT_PRIVATE_KEY_B64",
    "JWT_PUBLIC_KEY_B64",
    "DATA_ENCRYPTION_KEY",
    "LOOKUP_HASH_KEY",
    "OTP_HASH_KEY",
    "CORS_ORIGINS",
  ]) {
    if (!source[name]) throw new Error(`MISSING_PRODUCTION_${name}`);
  }
  const db = new URL(source.DATABASE_URL!),
    redis = new URL(source.REDIS_URL!);
  if (
    !["postgres:", "postgresql:"].includes(db.protocol) ||
    db.searchParams.get("sslmode") !== "verify-full"
  )
    throw new Error("POSTGRES_VERIFY_FULL_REQUIRED");
  if (redis.protocol !== "rediss:" || !redis.password)
    throw new Error("REDIS_TLS_AUTH_REQUIRED");
  for (const name of [
    "DATA_ENCRYPTION_KEY",
    "LOOKUP_HASH_KEY",
    "OTP_HASH_KEY",
  ]) {
    if (
      !/^[A-Za-z0-9+/]{43}=$/.test(source[name]!) ||
      Buffer.from(source[name]!, "base64").length !== 32
    )
      throw new Error(`INVALID_${name}`);
  }
  if (
    new Set(
      ["DATA_ENCRYPTION_KEY", "LOOKUP_HASH_KEY", "OTP_HASH_KEY"].map(
        (k) => source[k],
      ),
    ).size !== 3
  )
    throw new Error("INDEPENDENT_KEYS_REQUIRED");
  for (const origin of source.CORS_ORIGINS!.split(",")) {
    const u = new URL(origin.trim());
    if (
      u.protocol !== "https:" ||
      u.origin !== origin.trim() ||
      u.username ||
      u.password ||
      u.hostname.includes("*")
    )
      throw new Error("EXACT_HTTPS_ORIGINS_REQUIRED");
  }
  if (
    source.BLOCKCHAIN_NETWORK !== "mainnet" ||
    source.TRON_NETWORK !== "tron-mainnet"
  )
    throw new Error("EXPLICIT_MAINNET_REQUIRED");
  if (
    !manual && (source.TRON_PROVIDER !== "tron-http" ||
    !source.TRON_API_KEY ||
    !source.TRON_USDT_CONTRACT ||
    !source.TRON_REQUIRED_CONFIRMATIONS ||
    !source.TRON_API_URL?.startsWith("https://"))
  )
    throw new Error("TRON_CONFIGURATION_REQUIRED");
  if (manual && (source.MANUAL_DEPOSIT_SUBMISSIONS_ENABLED === "true" || source.TRANSACTIONS_ENABLED === "true" || source.PAYOUTS_ENABLED === "true") && (!validTronAddress(source.MANUAL_COLLECTION_ADDRESS ?? "") || source.PRIVATE_FINANCIAL_STORAGE !== "postgres-encrypted" || source.ANDROID_UPDATE_ENFORCED !== "true" || !source.APK_RELEASE_PUBLIC_KEY_B64 || !source.APK_ALLOWED_ORIGINS)) throw new Error("MANUAL_PRODUCTION_CONFIGURATION_REQUIRED");
  if (manual) {
    assertManualChainReader(source);
    assertReleaseSecurity(source, true);
    assertManualCapabilities(source);
    return;
  }
  for (const name of [
    "OTP_PROVIDER",
    "VERIFICATION_PROVIDER",
    "RATE_PROVIDER",
    "PAYOUT_PROVIDER",
    "EMAIL_PROVIDER",
    "SMS_PROVIDER",
    "PUSH_PROVIDER",
    "SUPPORT_STORAGE_PROVIDER",
  ]) {
    if (manual && ["PAYOUT_PROVIDER","RATE_PROVIDER"].includes(name)) continue;
    if (!source[name] || /mock|dev|sandbox/i.test(source[name]!))
      throw new Error(`UNSAFE_PROVIDER_${name}`);
  }
  assertReleaseSecurity(source, manual);
  // These ports currently have only mock implementations. Fail closed even if an operator
  // renames an env value to "live". Remove a capability gate only with a registered,
  // reviewed adapter and sandbox acceptance evidence. There is no bypass environment flag.
  throw new Error(
    manual ? "PRODUCTION_ADAPTERS_NOT_REGISTERED: OTP,verification,email,sms,push,storage" : "PRODUCTION_ADAPTERS_NOT_REGISTERED: OTP,verification,market,payout,email,sms,push,storage",
  );
}

import { z } from "zod";
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://127.0.0.1:3000"),
  TRANSACTIONS_ENABLED: z.enum(["false","true"]).default("false"),
  MANUAL_DEPOSIT_SUBMISSIONS_ENABLED: z.enum(["false","true"]).default("false"),
  TRADING_ENABLED: z.literal("false").default("false"),
  PAYOUTS_ENABLED: z.enum(["false","true"]).default("false"),
  // Optional opt-outs preserve legacy behavior while allowing a narrow manual cutover.
  OWNER_WALLET_ADJUSTMENTS_ENABLED: z.enum(["false", "true"]).optional(),
  REFERRAL_REWARD_RELEASE_ENABLED: z.enum(["false", "true"]).optional(),
  DEPOSITS_ENABLED: z.literal("false").default("false"),
});
export function readEnvironment(source: NodeJS.ProcessEnv = process.env) {
  const result = schema.safeParse(source);
  if (!result.success) throw new Error("Invalid environment configuration");
  if (source.NODE_ENV === "production") {
    for (const name of [
      "DATABASE_URL",
      "JWT_PRIVATE_KEY_B64",
      "JWT_PUBLIC_KEY_B64",
      "DATA_ENCRYPTION_KEY",
      "LOOKUP_HASH_KEY",
      "OTP_HASH_KEY",
    ])
      if (!source[name])
        throw new Error(`Missing production configuration: ${name}`);
    for (const name of [
      "DATA_ENCRYPTION_KEY",
      "LOOKUP_HASH_KEY",
      "OTP_HASH_KEY",
    ])
      if (Buffer.from(source[name]!, "base64").length !== 32)
        throw new Error(`Invalid key configuration: ${name}`);
    if (
      source.DEV_OTP_EXPOSE === "true" ||
      source.OTP_PROVIDER === "dev" ||
      source.VERIFICATION_PROVIDER === "mock" ||
      source.RATE_PROVIDER === "mock"
    )
      throw new Error("Development providers are forbidden in production");
    if (
      !result.data.CORS_ORIGINS.split(",").every((v) =>
        v.trim().startsWith("https://"),
      )
    )
      throw new Error("Production origins require HTTPS");
  }
  if(source.NODE_ENV==='production'&&!source.REDIS_URL)throw new Error('Missing production configuration: REDIS_URL');
  return result.data;
}
export const environment = readEnvironment();

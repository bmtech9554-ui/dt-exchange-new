import { safePublicHttps } from "./setup-report";

/** Manual approval remains mandatory; the reader only corroborates chain evidence. */
export function assertManualChainReader(s: NodeJS.ProcessEnv) {
  if (s.NODE_ENV !== "production" || s.MANUAL_DEPOSIT_REVIEW !== "true" ||
      s.TRANSACTIONS_ENABLED !== "true") return;
  if (s.TRON_PROVIDER !== "tron-http" || !s.TRON_API_URL ||
      !safePublicHttps(s.TRON_API_URL) || new URL(s.TRON_API_URL).search)
    throw new Error("MANUAL_CHAIN_READER_REQUIRED");
}

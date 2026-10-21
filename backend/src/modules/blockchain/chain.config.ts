import { validTronAddress } from "./tron-address";
import { ServiceUnavailableException } from "@nestjs/common";
export interface ChainConfig {
  enabled: boolean;
  provider: "mock" | "tron-http";
  network: string;
  contract: string;
  confirmations: number;
  scanInterval: number;
  orderExpiry: number;
  staleSeconds: number;
  sandbox: boolean;
}
export function chainConfig(): ChainConfig {
  const provider = process.env.TRON_PROVIDER ?? "mock",
    network = process.env.TRON_NETWORK ?? "tron-mock";
  const confirmations = Number(process.env.TRON_REQUIRED_CONFIRMATIONS ?? 20),
    scanInterval = Number(process.env.BLOCKCHAIN_SCAN_INTERVAL ?? 15000),
    orderExpiry = Number(process.env.ORDER_DEPOSIT_EXPIRY_SECONDS ?? 1800),
    staleSeconds = Number(process.env.CHAIN_STALE_REVIEW_SECONDS ?? 7200);
  if (
    !["mock", "tron-http"].includes(provider) ||
    !Number.isInteger(confirmations) ||
    confirmations < 1 ||
    confirmations > 10000 ||
    !Number.isInteger(scanInterval) ||
    scanInterval < 5000 ||
    !Number.isInteger(orderExpiry) ||
    orderExpiry < 60 ||
    orderExpiry > 86400 ||
    !Number.isInteger(staleSeconds) ||
    staleSeconds < 60
  )
    throw new ServiceUnavailableException("Invalid blockchain configuration");
  if (
    provider === "mock" &&
    (process.env.NODE_ENV === "production" || network !== "tron-mock")
  )
    throw new ServiceUnavailableException(
      "Mock chain cannot use a real network",
    );
  if (
    provider === "tron-http" &&
    !["tron-mainnet", "tron-shasta", "tron-nile"].includes(network)
  )
    throw new ServiceUnavailableException("Unsupported TRON network");
  const contract =
    process.env.TRON_USDT_CONTRACT ??
    (provider === "mock" ? "DT-MOCK-USDT-CONTRACT" : "");
  if (provider === "tron-http" && !validTronAddress(contract))
    throw new ServiceUnavailableException("Invalid configured USDT contract");
  if (!contract)
    throw new ServiceUnavailableException("Token contract is not configured");
  return {
    enabled: process.env.TRANSACTIONS_ENABLED === "true",
    provider: provider as ChainConfig["provider"],
    network,
    contract,
    confirmations,
    scanInterval,
    orderExpiry,
    staleSeconds,
    sandbox: provider === "mock",
  };
}
export function requireTransactions() {
  const c = chainConfig();
  if (!c.enabled)
    throw new ServiceUnavailableException("Transactions are not enabled");
  return c;
}

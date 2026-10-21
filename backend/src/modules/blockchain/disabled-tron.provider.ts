import { ServiceUnavailableException } from "@nestjs/common";
import { TronBlockchainProvider } from "./tron.provider";
/** Dormant port for manual production. No mock data or network calls. */
export class DisabledTronProvider extends TronBlockchainProvider {
  async getTransaction(): Promise<never> { throw new ServiceUnavailableException("Automatic blockchain integration disabled"); }
  async getLatestBlock(): Promise<never> { throw new ServiceUnavailableException("Automatic blockchain integration disabled"); }
  async getBlockHash(): Promise<never> { throw new ServiceUnavailableException("Automatic blockchain integration disabled"); }
  async fetchIncomingTransfers(): Promise<never> { throw new ServiceUnavailableException("Automatic blockchain integration disabled"); }
  validateAddress(): never { throw new ServiceUnavailableException("Automatic blockchain integration disabled"); }
  checkUsdtContract(): never { throw new ServiceUnavailableException("Automatic blockchain integration disabled"); }
}
export function dormantManualChain(s = process.env) {
  return s.NODE_ENV === "production" && s.MANUAL_DEPOSIT_REVIEW === "true" && s.AUTOMATED_BLOCKCHAIN_CREDIT === "false";
}

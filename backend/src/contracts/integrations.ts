import type { DecimalString, MinorUnitString, Network } from "./money";
/** Ports only: no provider is configured or invoked in Phase 1. */
export interface ConfirmedTransfer {
  readonly network: Network;
  readonly transactionHash: string;
  readonly eventIndex: number;
  readonly contractAddress: string;
  readonly rawAmount: string;
  readonly normalizedAmount: DecimalString;
  readonly sender: string;
  readonly receiver: string;
  readonly blockNumber: string;
  readonly blockHash: string;
  readonly confirmations: number;
  readonly timestamp: string;
}
export interface ChainReader {
  readTransfers(
    cursor: string,
  ): Promise<{ transfers: readonly ConfirmedTransfer[]; nextCursor: string }>;
  verifyFinality(
    transfer: ConfirmedTransfer,
  ): Promise<"confirmed" | "pending" | "reorged">;
}
export interface PayoutProvider {
  submit(input: {
    payoutId: string;
    idempotencyKey: string;
    beneficiaryToken: string;
    amountInrMinor: MinorUnitString;
    rail: "IMPS" | "NEFT" | "RTGS";
  }): Promise<{ reference: string; status: "pending" | "processing" }>;
  reconcile(reference: string): Promise<{
    status: "pending" | "processing" | "success" | "failed" | "reversed";
    utr?: string;
  }>;
  verifyWebhook(
    rawBody: Uint8Array,
    headers: Readonly<Record<string, string>>,
  ): Promise<boolean>;
}
export interface CustodyProvider {
  allocateDepositAddress(input: {
    userId: string;
    network: Network;
    asset: "USDT";
  }): Promise<{ address: string; reference: string }>;
}
export interface VerificationProvider {
  createApplicant(input: {
    userId: string;
    returnUrl: string;
  }): Promise<{ reference: string; activationUrl: string }>;
}
export const jobTopics = {
  chainScan: "chain.scan",
  chainConfirm: "chain.confirm",
  depositCredit: "deposit.credit",
  payoutSubmit: "payout.submit",
  payoutReconcile: "payout.reconcile",
  notificationDispatch: "notification.dispatch",
  outboxPublish: "outbox.publish",
} as const;

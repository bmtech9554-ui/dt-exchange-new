import { ConflictException, ServiceUnavailableException } from "@nestjs/common";
import { TronBlockchainProvider } from "../blockchain/tron.provider";
import { TronHttpProvider } from "../blockchain/providers/tron-http.provider";
import { ChainConfig } from "../blockchain/chain.config";
import { decimal } from "../rates/money";

export interface DepositChainEvidence {
  txHash: string;
  receiver: string;
  sender: string;
  contract: string;
  verifiedAmount: string;
  blockNumber: string;
  blockHash: string;
  transactionTime: string;
}

/** Read-only chain verification. This never approves a request or posts money. */
export async function verifyDepositOnChain(
  evidence: DepositChainEvidence,
  config: ChainConfig,
  provider: TronBlockchainProvider = new TronHttpProvider(),
) {
  if (config.sandbox || config.provider !== "tron-http")
    throw new ServiceUnavailableException("Independent chain reader required");
  let transaction, head, canonicalHash;
  try {
    transaction = await provider.getTransaction(evidence.txHash);
    head = await provider.getLatestBlock();
    canonicalHash = await provider.getBlockHash(BigInt(evidence.blockNumber));
  } catch {
    throw new ServiceUnavailableException("Chain verification unavailable; no credit posted");
  }
  if (!transaction || transaction.txHash !== evidence.txHash ||
      !transaction.canonical || transaction.execution !== "SUCCESS")
    throw new ConflictException("Successful canonical transaction required");
  const matches = transaction.transfers.filter(t =>
    t.network === config.network && t.txHash === evidence.txHash &&
    t.contract === config.contract && t.receiver === evidence.receiver);
  // Multiple matching transfers need explicit reconciliation, never guess an event.
  if (matches.length !== 1)
    throw new ConflictException("One matching USDT transfer required");
  const transfer = matches[0]!;
  const block = BigInt(evidence.blockNumber);
  const confirmations = head >= block ? head - block + 1n : 0n;
  if (transfer.execution !== "SUCCESS" || transfer.decimals !== 6 ||
      transfer.contract !== evidence.contract || transfer.sender !== evidence.sender ||
      transfer.rawAmount !== decimal(evidence.verifiedAmount, 6).toString() ||
      transfer.blockNumber !== evidence.blockNumber ||
      transfer.blockHash !== evidence.blockHash || canonicalHash !== transfer.blockHash ||
      Date.parse(transfer.timestamp) !== Date.parse(evidence.transactionTime) ||
      !Number.isSafeInteger(transfer.eventIndex) || transfer.eventIndex < 0 ||
      confirmations < BigInt(config.confirmations))
    throw new ConflictException("Independent blockchain evidence does not match");
  return {
    eventIndex: transfer.eventIndex,
    confirmations: Number(confirmations > 100000n ? 100000n : confirmations),
    checkedAt: new Date().toISOString(),
    source: "tron-http",
  };
}

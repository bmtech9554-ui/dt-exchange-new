export interface ChainTransfer {
  network: string;
  txHash: string;
  eventIndex: number;
  contract: string;
  sender: string;
  receiver: string;
  rawAmount: string;
  decimals: 6;
  blockNumber: string;
  blockHash: string;
  timestamp: string;
  execution: "SUCCESS" | "FAILED";
}
export interface ChainTransaction {
  txHash: string;
  transfers: ChainTransfer[];
  canonical: boolean;
  execution: "SUCCESS" | "FAILED";
}
export interface ScanCursor {
  from?: number;
  until?: number;
  fingerprint?: string;
}
export abstract class TronBlockchainProvider {
  abstract getTransaction(hash: string): Promise<ChainTransaction | null>;
  abstract getLatestBlock(): Promise<bigint>;
  abstract getBlockHash(block: bigint): Promise<string>;
  abstract fetchIncomingTransfers(
    address: string,
    cursor: ScanCursor,
  ): Promise<{ transactions: string[]; cursor: ScanCursor; complete: boolean }>;
  abstract validateAddress(address: string): boolean;
  abstract checkUsdtContract(contract: string): boolean;
  async getTokenTransferDetails(hash: string) {
    return (await this.getTransaction(hash))?.transfers ?? [];
  }
  async getConfirmations(block: bigint) {
    const head = await this.getLatestBlock();
    return head >= block ? head - block + 1n : 0n;
  }
}

import { Injectable } from "@nestjs/common";
import { readFile } from "node:fs/promises";
import {
  TronBlockchainProvider,
  ChainTransaction,
  ScanCursor,
} from "../tron.provider";
import { chainConfig } from "../chain.config";
@Injectable()
export class MockTronProvider extends TronBlockchainProvider {
  head = 1000n;
  transactions = new Map<string, ChainTransaction>();
  private async fixture() {
    const c = chainConfig();
    if (!c.sandbox) throw new Error("MOCK_PROVIDER_DISABLED");
    if (process.env.TRON_MOCK_FIXTURE_FILE) {
      const parsed = JSON.parse(
        await readFile(process.env.TRON_MOCK_FIXTURE_FILE, "utf8"),
      );
      if (
        !Array.isArray(parsed.transactions) ||
        parsed.transactions.length > 10000 ||
        !/^\d{1,16}$/.test(parsed.head)
      )
        throw new Error("INVALID_MOCK_FIXTURE");
      this.head = BigInt(parsed.head);
      this.transactions = new Map(
        parsed.transactions.map((t: ChainTransaction) => [t.txHash, t]),
      );
    }
  }
  async getTransaction(hash: string) {
    await this.fixture();
    return this.transactions.get(hash) ?? null;
  }
  async getLatestBlock() {
    await this.fixture();
    return this.head;
  }
  async getBlockHash(block: bigint) {
    await this.fixture();
    for (const t of this.transactions.values()) {
      const v = t.transfers.find((t) => BigInt(t.blockNumber) === block);
      if (v && t.canonical) return v.blockHash;
    }
    if (
      [...this.transactions.values()].some((t) =>
        t.transfers.some((v) => BigInt(v.blockNumber) === block),
      )
    )
      return "f".repeat(64);
    return block.toString(16).padStart(64, "0");
  }
  async fetchIncomingTransfers(address: string, _cursor: ScanCursor) {
    await this.fixture();
    return {
      transactions: [...this.transactions.values()]
        .filter((t) => t.transfers.some((v) => v.receiver === address))
        .map((t) => t.txHash),
      cursor: {},
      complete: true,
    };
  }
  validateAddress(address: string) {
    return /^DT-MOCK-TRON-[a-f0-9]{40}$/.test(address);
  }
  checkUsdtContract(contract: string) {
    return contract === chainConfig().contract;
  }
}

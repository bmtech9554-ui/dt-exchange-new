import { Injectable } from "@nestjs/common";
import {
  TronBlockchainProvider,
  ChainTransaction,
  ChainTransfer,
  ScanCursor,
} from "../tron.provider";
import { chainConfig } from "../chain.config";
import { tronAddress, validTronAddress } from "../tron-address";
const transferTopic =
  "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export async function providerJson(
  url: URL,
  init: RequestInit = {},
): Promise<any> {
  if (url.protocol !== "https:") throw new Error("PROVIDER_HTTPS_REQUIRED");
  const response = await fetch(url, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("PROVIDER_HTTP_FAILURE");
  if (!response.body) throw new Error("PROVIDER_EMPTY_RESPONSE");
  const reader = response.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const r = await reader.read();
    if (r.done) break;
    size += r.value.length;
    if (size > 2 * 1024 * 1024) {
      await reader.cancel();
      throw new Error("PROVIDER_RESPONSE_TOO_LARGE");
    }
    chunks.push(r.value);
  }
  const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (data.Error || data.error || data.success === false)
    throw new Error("PROVIDER_API_FAILURE");
  return data;
}
function integer(value: unknown): bigint {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
    return BigInt(value);
  if (typeof value === "string" && /^\d{1,16}$/.test(value))
    return BigInt(value);
  throw new Error("INVALID_BLOCK");
}
@Injectable()
export class TronHttpProvider extends TronBlockchainProvider {
  private async rpc(path: string, body: object = {}) {
    const base = process.env.TRON_API_URL;
    if (!base) throw new Error("PROVIDER_NOT_CONFIGURED");
    return providerJson(new URL(path, base), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.TRON_API_KEY
          ? { "TRON-PRO-API-KEY": process.env.TRON_API_KEY }
          : {}),
      },
      body: JSON.stringify(body),
    });
  }
  async getLatestBlock() {
    const b = await this.rpc("/wallet/getnowblock");
    return integer(b.block_header?.raw_data?.number);
  }
  async getBlockHash(block: bigint) {
    const b = await this.rpc("/wallet/getblockbynum", { num: Number(block) });
    if (
      integer(b.block_header?.raw_data?.number) !== block ||
      !/^[a-f0-9]{64}$/.test(b.blockID)
    )
      throw new Error("INVALID_BLOCK_HASH");
    return b.blockID as string;
  }
  async getTransaction(hash: string): Promise<ChainTransaction | null> {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("INVALID_HASH");
    const [body, receipt] = await Promise.all([
      this.rpc("/wallet/gettransactionbyid", { value: hash }),
      this.rpc("/wallet/gettransactioninfobyid", { value: hash }),
    ]);
    if (!body.txID && !receipt.id) return null;
    if (body.txID !== hash || receipt.id !== hash)
      throw new Error("INCOMPLETE_TRANSACTION");
    const block = integer(receipt.blockNumber),
      blockHash = await this.getBlockHash(block);
    const execution =
      Array.isArray(body.ret) &&
      body.ret.length > 0 &&
      body.ret.every((v: any) => v.contractRet === "SUCCESS") &&
      (!receipt.receipt?.result || receipt.receipt.result === "SUCCESS")
        ? "SUCCESS"
        : "FAILED";
    const timestamp = integer(receipt.blockTimeStamp);
    if (timestamp > BigInt(Date.now() + 60000))
      throw new Error("INVALID_TIMESTAMP");
    if (!Array.isArray(receipt.log ?? []) || (receipt.log ?? []).length > 1000)
      throw new Error("INVALID_LOGS");
    const transfers: ChainTransfer[] = [];
    for (const [eventIndex, log] of (receipt.log ?? []).entries()) {
      if (log.topics?.[0] !== transferTopic) continue;
      if (
        log.topics.length !== 3 ||
        !log.topics.every(
          (v: unknown) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v),
        ) ||
        !/^[a-f0-9]{64}$/.test(log.data) ||
        !/^0{24}/.test(log.topics[1]) ||
        !/^0{24}/.test(log.topics[2])
      )
        throw new Error("INVALID_TRANSFER_LOG");
      transfers.push({
        network: chainConfig().network,
        txHash: hash,
        eventIndex,
        contract: tronAddress(log.address),
        sender: tronAddress(log.topics[1].slice(24)),
        receiver: tronAddress(log.topics[2].slice(24)),
        rawAmount: BigInt("0x" + log.data).toString(),
        decimals: 6,
        blockNumber: block.toString(),
        blockHash,
        timestamp: new Date(Number(timestamp)).toISOString(),
        execution,
      });
    }
    return { txHash: hash, transfers, canonical: true, execution };
  }
  async fetchIncomingTransfers(address: string, cursor: ScanCursor) {
    if (!this.validateAddress(address)) throw new Error("INVALID_ADDRESS");
    const base = process.env.TRON_INDEXER_URL ?? process.env.TRON_API_URL;
    if (!base) throw new Error("PROVIDER_NOT_CONFIGURED");
    const until = cursor.until ?? Date.now(),
      from = cursor.from ?? 0;
    const url = new URL(`/v1/accounts/${address}/transactions/trc20`, base);
    url.search = new URLSearchParams({
      limit: "200",
      only_to: "true",
      only_confirmed: "false",
      order_by: "block_timestamp,asc",
      min_timestamp: String(from),
      max_timestamp: String(until),
      contract_address: chainConfig().contract,
      ...(cursor.fingerprint ? { fingerprint: cursor.fingerprint } : {}),
    }).toString();
    const r = await providerJson(url, {
      headers: process.env.TRON_API_KEY
        ? { "TRON-PRO-API-KEY": process.env.TRON_API_KEY }
        : {},
    });
    if (!Array.isArray(r.data) || r.data.length > 200)
      throw new Error("INVALID_INDEXER_RESPONSE");
    const transactions: string[] = [];
    for (const item of r.data) {
      if (!/^[a-f0-9]{64}$/.test(item.transaction_id))
        throw new Error("INVALID_INDEXER_HASH");
      transactions.push(item.transaction_id);
    }
    const fingerprint = r.meta?.fingerprint;
    if (
      fingerprint !== undefined &&
      (typeof fingerprint !== "string" || fingerprint.length > 2048)
    )
      throw new Error("INVALID_CURSOR");
    return {
      transactions: [...new Set(transactions)],
      cursor: fingerprint ? { from, until, fingerprint } : { from },
      complete: !fingerprint,
    };
  }
  validateAddress(address: string) {
    return validTronAddress(address);
  }
  checkUsdtContract(contract: string) {
    return contract === chainConfig().contract && validTronAddress(contract);
  }
}

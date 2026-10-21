import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../common/database.service";
import { TronBlockchainProvider } from "./tron.provider";
import { requireTransactions } from "./chain.config";
import { DepositsService } from "../deposits/deposits.service";
@Injectable()
export class ScanService {
  constructor(
    private readonly db: DatabaseService,
    private readonly provider: TronBlockchainProvider,
    private readonly deposits: DepositsService,
  ) {}
  async addresses() {
    if(process.env.MANUAL_DEPOSIT_REVIEW === "true") return [];
    const c = requireTransactions();
    return (
      await this.db.query(
        "SELECT a.id FROM wallet_addresses a JOIN chain_scan_cursors s ON s.wallet_address_id=a.id WHERE a.network_code=$1 ORDER BY s.last_scheduled_at NULLS FIRST LIMIT 100",
        [c.network],
      )
    ).rows;
  }
  async scan(id: string) {
    if(process.env.MANUAL_DEPOSIT_REVIEW === "true") return;
    const a = (
      await this.db.query(
        "SELECT a.*,s.cursor,s.version FROM wallet_addresses a JOIN chain_scan_cursors s ON s.wallet_address_id=a.id WHERE a.id=$1 AND a.network_code=$2",
        [id, requireTransactions().network],
      )
    ).rows[0];
    if (!a) return;
    const cursor = Object.keys(a.cursor).length
      ? a.cursor
      : { from: new Date(a.assigned_at).getTime(), until: Date.now() };
    const result = await this.provider.fetchIncomingTransfers(
      a.address,
      cursor,
    );
    for (const hash of result.transactions) await this.deposits.inspect(hash);
    await this.db.query(
      "UPDATE chain_scan_cursors SET cursor=$2,last_scan_at=now(),version=version+1 WHERE wallet_address_id=$1 AND version=$3",
      [id, JSON.stringify(result.complete ? {} : result.cursor), a.version],
    );
  }
  async pending() {
    if(process.env.MANUAL_DEPOSIT_REVIEW === "true") return [];
    return (
      await this.db.query(
        "SELECT b.tx_hash FROM blockchain_transactions b JOIN deposits d ON d.transaction_id=b.id WHERE b.network_code=$1 AND b.status IN ('detected','confirming','confirmed') AND d.status<>'review' GROUP BY b.tx_hash ORDER BY min(b.last_checked_at) NULLS FIRST LIMIT 1000",
        [requireTransactions().network],
      )
    ).rows;
  }
}

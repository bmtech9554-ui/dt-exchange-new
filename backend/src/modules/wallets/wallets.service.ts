import {
  Injectable,
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { DatabaseService, SqlClient } from "../../common/database.service";
import { AddressCustodyProvider } from "./custody.provider";
import { TronBlockchainProvider } from "../blockchain/tron.provider";
import { requireTransactions, chainConfig } from "../blockchain/chain.config";
@Injectable()
export class WalletsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly custody: AddressCustodyProvider,
    private readonly chain: TronBlockchainProvider,
  ) {}
  async configuration(tx: SqlClient) {
    const c = requireTransactions();
    const row = (
      await tx.query(
        "SELECT n.chain_id,n.required_confirmations,t.contract_address,t.decimals FROM networks n JOIN token_contracts t ON t.network_code=n.code WHERE n.code=$1 AND t.asset_symbol='USDT' AND n.enabled AND t.enabled",
        [c.network],
      )
    ).rows[0];
    if (
      !row ||
      row.chain_id !== c.network ||
      row.contract_address !== c.contract ||
      row.decimals !== 6 ||
      row.required_confirmations !== c.confirmations
    )
      throw new ServiceUnavailableException(
        "Chain configuration has not been provisioned",
      );
    return c;
  }
  async allocate(
    tx: SqlClient,
    uid: string,
    key: string,
    purpose: "wallet" | "order",
  ) {
    const c = await this.configuration(tx);
    const u = (
      await tx.query(
        "SELECT status,verification_status FROM users WHERE id=$1 FOR UPDATE",
        [uid],
      )
    ).rows[0];
    if (u?.status !== "active" || u.verification_status !== "verified")
      throw new ForbiddenException("Verification required");
    const old = (
      await tx.query(
        "SELECT a.*,w.status wallet_status FROM wallet_addresses a JOIN wallets w ON w.id=a.wallet_id WHERE a.allocation_key=$1 AND a.user_id=$2",
        [key, uid],
      )
    ).rows[0];
    if (old && (old.retired_at || old.wallet_status !== "active"))
      throw new ForbiddenException("Deposit address unavailable");
    if (old) return old;
    const w = (
      await tx.query(
        "INSERT INTO wallets(user_id,asset_symbol,status) VALUES($1,'USDT','active') ON CONFLICT(user_id,asset_symbol) DO UPDATE SET status=wallets.status RETURNING id,status",
        [uid],
      )
    ).rows[0]!;
    if (w.status !== "active")
      throw new ForbiddenException("Wallet unavailable");
    const allocation = await this.custody.allocate({
      userId: uid,
      allocationKey: key,
      purpose,
    });
    if (
      !this.chain.validateAddress(allocation.address) ||
      allocation.network !== c.network ||
      allocation.sandbox !== c.sandbox
    )
      throw new ServiceUnavailableException(
        "Custody returned an invalid address",
      );
    const a = (
      await tx.query(
        "INSERT INTO wallet_addresses(wallet_id,user_id,asset_symbol,network_code,address,custody_provider,custody_ref,purpose,allocation_key) VALUES($1,$2,'USDT',$3,$4,$5,$6,$7,$8) RETURNING *",
        [
          w.id,
          uid,
          c.network,
          allocation.address,
          allocation.provider,
          allocation.reference,
          purpose,
          key,
        ],
      )
    ).rows[0]!;
    await tx.query(
      "INSERT INTO chain_scan_cursors(wallet_address_id) VALUES($1)",
      [a.id],
    );
    return a;
  }
  async address(uid: string) {
    if(process.env.MANUAL_DEPOSIT_REVIEW==='true') {
      const c=requireTransactions();const address=process.env.MANUAL_COLLECTION_ADDRESS;
      const controls=(await this.db.query("SELECT value FROM system_settings WHERE key='operational_controls'")).rows[0]?.value;
      if(controls?.mode!=='NORMAL'||controls?.deposits!==true)throw new ServiceUnavailableException('Deposits paused');
      if(!address)throw new ServiceUnavailableException('Manual receiving wallet unavailable');
      return {...this.addressView({address,network_code:c.network}),manualReview:true};
    }
    return this.db.transaction(async (tx) => {
      await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [uid]);
      const a = await this.allocate(
        tx,
        uid,
        `wallet-${chainConfig().network}-${uid}`,
        "wallet",
      );
      return this.addressView(a);
    });
  }
  addressView(a: Record<string, any>) {
    const c = chainConfig();
    return {
      address: a.address,
      qrPayload: a.address,
      network: "TRC20",
      chainNetwork: a.network_code,
      asset: "USDT",
      sandbox: c.sandbox,
      requiredConfirmations: c.confirmations,
    };
  }
  async balance(uid: string) {
    const rows = (
      await this.db.query(
        "SELECT asset_symbol,bucket,balance::text FROM ledger_balances WHERE user_id=$1",
        [uid],
      )
    ).rows;
    const balance = (asset: string, bucket: string) =>
      rows.find((r) => r.asset_symbol === asset && r.bucket === bucket)
        ?.balance ?? "0";
    return {
      availableUsdt: balance("USDT", "available"),
      reservedUsdt: balance("USDT", "reserved"),
      pendingInr: balance("INR", "payout_clearing"),
      source: "ledger",
      // Ledger reads do not require a blockchain adapter or transaction enablement.
      sandbox: process.env.NODE_ENV !== "production" && (process.env.TRON_PROVIDER ?? "mock") === "mock",
    };
  }
}

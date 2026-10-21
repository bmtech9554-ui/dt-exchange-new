import { Injectable, ConflictException, ServiceUnavailableException } from "@nestjs/common";
import { privateBetaEnabled } from '../../common/private-beta';
import { SqlClient } from "../../common/database.service";
import { databaseUnits, format } from "../rates/money";
type Line = {
  account: string;
  asset: string;
  side: "debit" | "credit";
  amount: string;
};
@Injectable()
export class LedgerService {
  async account(
    tx: SqlClient,
    user: string | null,
    asset: string,
    bucket: string,
    kind = "liability",
  ) {
    const code = `${user ?? "platform"}:${asset}:${bucket}`;
    return (
      await tx.query(
        `INSERT INTO ledger_accounts(code,user_id,asset_symbol,kind,bucket,normal_side) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(code) DO UPDATE SET code=excluded.code RETURNING id`,
        [
          code,
          user,
          asset,
          kind,
          bucket,
          ["asset", "expense"].includes(kind) ? "debit" : "credit",
        ],
      )
    ).rows[0]!.id as string;
  }
  async post(
    tx: SqlClient,
    key: string,
    type: string,
    source: string,
    lines: Line[],
    reversal?: string,
    createdByAdmin?: string,
  ) {
    // Defence in depth for every caller, including owner adjustments and workers.
    // A synthetic beta must not post even a balanced journal to the real ledger.
    if (privateBetaEnabled()) throw new ServiceUnavailableException();
    const j = (
      await tx.query(
        "INSERT INTO ledger_journals(event_key,event_type,source_id,description,reversal_of,created_by_admin) VALUES($1,$2,$3,$2,$4,$5) ON CONFLICT(event_key) DO NOTHING RETURNING id",
        [key, type, source, reversal ?? null, createdByAdmin ?? null],
      )
    ).rows[0];
    if (!j) return false;
    for (const l of lines)
      await tx.query(
        "INSERT INTO ledger_entries(journal_id,account_id,asset_symbol,side,amount) VALUES($1,$2,$3,$4,$5)",
        [j.id, l.account, l.asset, l.side, l.amount],
      );
    console.log(JSON.stringify({event:"ledger_journal_staged",journalId:j.id,eventType:type,sourceId:source}));
    return true;
  }
  async deposit(tx: SqlClient, d: Record<string, any>) {
    const gross=databaseUnits(d.amount,6),fee=databaseUnits(d.fee??'0',6);
    if(fee<0n||fee>=gross)throw new ConflictException('Invalid deposit net credit');
    const custody=await this.account(tx,null,'USDT','custody','asset'),available=await this.account(tx,d.user_id,'USDT','available');
    const lines:Line[]=[{account:custody,asset:'USDT',side:'debit',amount:format(gross,6)},{account:available,asset:'USDT',side:'credit',amount:format(gross-fee,6)}];
    if(fee>0n)lines.push({account:await this.account(tx,null,'USDT','fees','income'),asset:'USDT',side:'credit',amount:format(fee,6)});
    return this.post(tx,`deposit:${d.network_code}:${d.tx_hash}`,'deposit',d.id,lines);
  }
  async sell(tx: SqlClient, o: Record<string, any>) {
    const available = await this.account(tx, o.user_id, "USDT", "available"),
      reserved = await this.account(tx, o.user_id, "USDT", "reserved");
    const existing = (
      await tx.query("SELECT id FROM ledger_journals WHERE event_key=$1", [
        `sell:${o.id}`,
      ])
    ).rows[0];
    if (existing) return;
    const balance = (
      await tx.query(
        "SELECT balance::text FROM ledger_balances WHERE account_id=$1",
        [available],
      )
    ).rows[0]!;
    if (databaseUnits(balance.balance, 6) < databaseUnits(o.amount_usdt, 6))
      throw new ConflictException("Insufficient available USDT");
    const fxUsdt = await this.account(tx, null, "USDT", "adjustment", "equity"),
      fxInr = await this.account(tx, null, "INR", "adjustment", "equity"),
      pending = await this.account(tx, o.user_id, "INR", "payout_clearing");
    await this.post(tx, `reserve:${o.id}`, "reserve", o.id, [
      {
        account: available,
        asset: "USDT",
        side: "debit",
        amount: o.amount_usdt,
      },
      {
        account: reserved,
        asset: "USDT",
        side: "credit",
        amount: o.amount_usdt,
      },
    ]);
    const gross = format(BigInt(o.gross_inr_minor), 2);
    await this.post(tx, `sell:${o.id}`, "sell", o.id, [
      {
        account: reserved,
        asset: "USDT",
        side: "debit",
        amount: o.amount_usdt,
      },
      { account: fxUsdt, asset: "USDT", side: "credit", amount: o.amount_usdt },
      { account: fxInr, asset: "INR", side: "debit", amount: gross },
      { account: pending, asset: "INR", side: "credit", amount: gross },
    ]);
    if (BigInt(o.fee_inr_minor) > 0n) {
      const fee = await this.account(tx, null, "INR", "fees", "income");
      await this.post(tx, `fee:${o.id}`, "fee", o.id, [
        {
          account: pending,
          asset: "INR",
          side: "debit",
          amount: format(BigInt(o.fee_inr_minor), 2),
        },
        {
          account: fee,
          asset: "INR",
          side: "credit",
          amount: format(BigInt(o.fee_inr_minor), 2),
        },
      ]);
    }
  }
  async reverse(tx: SqlClient, key: string) {
    const j = (
      await tx.query("SELECT * FROM ledger_journals WHERE event_key=$1", [key])
    ).rows[0];
    if (!j) return;
    const entries = (
      await tx.query("SELECT * FROM ledger_entries WHERE journal_id=$1", [j.id])
    ).rows;
    await this.post(
      tx,
      `reverse:${key}`,
      "reversal",
      j.source_id,
      entries.map((e) => ({
        account: e.account_id,
        asset: e.asset_symbol,
        side: e.side === "credit" ? "debit" : "credit",
        amount: e.amount,
      })),
      j.id,
    );
  }
  async reverseSell(tx: SqlClient, id: string) {
    for (const type of ["fee", "sell", "reserve"])
      await this.reverse(tx, `${type}:${id}`);
  }
}

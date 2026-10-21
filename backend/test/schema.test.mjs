import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
let db;
const id = () => randomUUID();
const insert = async (sql, args = []) => (await db.query(sql, args)).rows[0];
async function user() {
  return insert(
    "INSERT INTO users(email_lookup_hash,email_ciphertext,terms_version,terms_accepted_at) VALUES($1,'\\x01','v1',now()) RETURNING id",
    [id()],
  );
}
async function bank(uid) {
  return insert(
    "INSERT INTO bank_accounts(user_id,holder_name_ciphertext,account_number_ciphertext,account_fingerprint,last_four,ifsc,bank_name,verification_status,is_default) VALUES($1,'\\x01','\\x02',$2,'1234','TEST0000001','Test Bank','verified',false) RETURNING id",
    [uid, id()],
  );
}
async function transaction(body) {
  await db.exec("BEGIN");
  try {
    const result = await body();
    await db.exec("COMMIT");
    return result;
  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  }
}
let rate, fee, policy;
before(async () => {
  db = new PGlite();
  await db.exec(
    await readFile(
      new URL("../migrations/001_foundation.sql", import.meta.url),
      "utf8",
    ),
  );
  const seed = await readFile(
    new URL("../seeds/001_reference.sql", import.meta.url),
    "utf8",
  );
  await db.exec(seed);
  await db.exec(seed);
  rate = await insert(
    "INSERT INTO exchange_rates(base_asset,quote_asset,mode,effective_rate,source,observed_at,expires_at) VALUES('USDT','INR','manual',90,'test_fixture',now(),now()+interval '1 day') RETURNING id",
  );
  fee = await insert(
    "INSERT INTO fees(version,flat_inr_minor,effective_from) VALUES(1,100,now()) RETURNING id",
  );
  policy = await insert(
    "INSERT INTO rate_policies(version,mode,manual_rate,minimum_sell,maximum_sell,daily_limit,monthly_limit,quote_expiry_seconds,maximum_rate_age_seconds,fee_id,effective_from) VALUES(1,'manual',90,1,1000,2000,20000,60,60,$1,now()) RETURNING id",
    [fee.id],
  );
});
after(async () => {
  await db?.close();
});
async function quote(uid, bid, { expired = false } = {}) {
  return insert(
    `INSERT INTO quotes(user_id,bank_account_id,funding_source,amount_usdt,rate_inr,gross_inr_minor,fee_inr_minor,net_inr_minor,exchange_rate_id,fee_id,rate_policy_id,created_at,expires_at)
 VALUES($1,$2,'onchain',10,90,90000,100,89900,$3,$4,$5,now()-interval '2 minutes',now()+$6::interval) RETURNING *`,
    [uid, bid, rate.id, fee.id, policy.id, expired ? "-1 minute" : "1 minute"],
  );
}
async function order(uid, bid, qid) {
  return insert(
    "INSERT INTO sell_orders(order_number,user_id,bank_account_id,quote_id,funding_source,funding_deadline) VALUES($1,$2,$3,$4,'onchain',now()+interval '30 minutes') RETURNING *",
    [id(), uid, bid, qid],
  );
}
async function accounts() {
  const u = await user();
  const a = await insert(
    "INSERT INTO ledger_accounts(code,asset_symbol,kind,bucket,normal_side) VALUES($1,'USDT','asset','custody','debit') RETURNING id",
    [id()],
  );
  const b = await insert(
    "INSERT INTO ledger_accounts(code,user_id,asset_symbol,kind,bucket,normal_side) VALUES($1,$2,'USDT','liability','available','credit') RETURNING id",
    [id(), u.id],
  );
  return [a, b];
}
async function journal(a, b, { debit = "10", credit = "10" } = {}) {
  return transaction(async () => {
    const j = await insert(
      "INSERT INTO ledger_journals(event_key,event_type,source_id,description) VALUES($1,'deposit',$2,'test fixture') RETURNING id",
      [id(), id()],
    );
    await db.query(
      "INSERT INTO ledger_entries(journal_id,account_id,asset_symbol,side,amount) VALUES($1,$2,'USDT','debit',$4),($1,$3,'USDT','credit',$5)",
      [j.id, a.id, b.id, debit, credit],
    );
    return j;
  });
}
test("All requested business tables exist; defaults disable financial features", async () => {
  const { rows } = await db.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public'",
  );
  const tables = new Set(rows.map((x) => x.tablename));
  for (const name of [
    "users",
    "user_profiles",
    "sessions",
    "verification_records",
    "verification_documents",
    "bank_accounts",
    "wallets",
    "wallet_addresses",
    "blockchain_transactions",
    "deposits",
    "sell_orders",
    "exchange_rates",
    "fees",
    "ledger_accounts",
    "ledger_entries",
    "payouts",
    "referrals",
    "notifications",
    "support_tickets",
    "admin_users",
    "admin_roles",
    "audit_logs",
    "login_history",
    "system_settings",
  ])
    assert(tables.has(name), name);
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM system_settings WHERE key IN ('trading_enabled','deposits_enabled','payouts_enabled') AND value='false'",
      )
    ).rows[0].count,
    3,
  );
});
test("Bank ownership prevents a quote referencing another user bank", async () => {
  const a = await user(),
    b = await user(),
    ba = await bank(a.id);
  await assert.rejects(quote(b.id, ba.id), /foreign key/);
});
test("Only one verified active default bank is allowed; bank identity is immutable", async () => {
  const u = await user(),
    a = await bank(u.id),
    b = await bank(u.id);
  await db.query("UPDATE bank_accounts SET is_default=true WHERE id=$1", [
    a.id,
  ]);
  await assert.rejects(
    db.query("UPDATE bank_accounts SET is_default=true WHERE id=$1", [b.id]),
    /unique/,
  );
  await assert.rejects(
    db.query("UPDATE bank_accounts SET ifsc='DIFF0000001' WHERE id=$1", [a.id]),
    /immutable/,
  );
});
test("Accepted quote cannot be changed or reused; order preserves quote reference", async () => {
  const u = await user(),
    b = await bank(u.id),
    q = await quote(u.id, b.id),
    o = await order(u.id, b.id, q.id);
  assert.equal(o.quote_id, q.id);
  await assert.rejects(
    db.query("UPDATE quotes SET rate_inr=95 WHERE id=$1", [q.id]),
    /immutable/,
  );
  await assert.rejects(order(u.id, b.id, q.id), /unique/);
  const q2 = await quote(u.id, b.id);
  await assert.rejects(
    db.query("UPDATE sell_orders SET quote_id=$1 WHERE id=$2", [q2.id, o.id]),
    /immutable/,
  );
});
test("Expired quote acceptance fails", async () => {
  const u = await user(),
    b = await bank(u.id),
    q = await quote(u.id, b.id, { expired: true });
  await assert.rejects(order(u.id, b.id, q.id), /expired/);
});
test("Payout amount must equal accepted net quote, with immutable beneficiary terms", async () => {
  const u = await user(),
    b = await bank(u.id),
    q = await quote(u.id, b.id),
    o = await order(u.id, b.id, q.id);
  const sql =
    "INSERT INTO payouts(order_id,user_id,bank_account_id,beneficiary_snapshot_ciphertext,rail,amount_inr_minor,idempotency_key,provider) VALUES($1,$2,$3,'\\x01','IMPS',$4,$5,'test_fixture') RETURNING id";
  await assert.rejects(
    db.query(sql, [o.id, u.id, b.id, 99999, id()]),
    /accepted net quote/,
  );
  const p = await insert(sql, [o.id, u.id, b.id, 89900, id()]);
  await assert.rejects(
    db.query(
      "UPDATE payouts SET beneficiary_snapshot_ciphertext='\\x02' WHERE id=$1",
      [p.id],
    ),
    /immutable/,
  );
});
test("Duplicate chain event cannot be stored twice; distinct transfer event is allowed", async () => {
  await db.exec(
    "INSERT INTO token_contracts(network_code,asset_symbol,contract_address,decimals) VALUES('TRON','USDT','TEST_CONTRACT_NOT_REAL',6)",
  );
  const hash = id();
  const sql =
    "INSERT INTO blockchain_transactions(network_code,tx_hash,event_index,asset_symbol,contract_address,sender,receiver,raw_amount,amount,block_number,block_hash,block_timestamp) VALUES('TRON',$1,$2,'USDT','TEST_CONTRACT_NOT_REAL','TEST_SENDER','TEST_RECEIVER',10000000,10,1,'TEST_BLOCK',now()) RETURNING id";
  const a = await insert(sql, [hash, 0]);
  await assert.rejects(db.query(sql, [hash, 0]), /unique/);
  await db.query(sql, [hash, 1]);
  await assert.rejects(
    db.query("UPDATE blockchain_transactions SET tx_hash=$1 WHERE id=$2", [
      id(),
      a.id,
    ]),
    /immutable/,
  );
});
test("Balanced journal derives exact balance, rejects mutations and later appends", async () => {
  const [a, b] = await accounts();
  const j = await journal(a, b, { debit: "123.123456", credit: "123.123456" });
  const balance = await insert(
    "SELECT balance FROM ledger_balances WHERE account_id=$1",
    [b.id],
  );
  assert.equal(balance.balance, "123.123456000000000000");
  await assert.rejects(
    db.query("UPDATE ledger_entries SET amount=1 WHERE journal_id=$1", [j.id]),
    /immutable/,
  );
  await assert.rejects(
    db.query("DELETE FROM ledger_entries WHERE journal_id=$1", [j.id]),
    /immutable/,
  );
  await assert.rejects(
    db.query(
      "INSERT INTO ledger_entries(journal_id,account_id,asset_symbol,side,amount) VALUES($1,$2,'USDT','credit',1)",
      [j.id, b.id],
    ),
    /committed journal/,
  );
});
test("Unbalanced and empty journals fail at commit and roll back", async () => {
  const [a, b] = await accounts();
  await assert.rejects(
    journal(a, b, { debit: "10", credit: "9" }),
    /must balance/,
  );
  assert.equal(
    (
      await insert("SELECT balance FROM ledger_balances WHERE account_id=$1", [
        b.id,
      ])
    ).balance,
    "0.000000000000000000",
  );
  await assert.rejects(
    transaction(() =>
      db.query(
        "INSERT INTO ledger_journals(event_key,event_type,source_id,description) VALUES($1,'deposit',$2,'empty')",
        [id(), id()],
      ),
    ),
    /at least two/,
  );
});
test("Journal asset must match account; INR cannot post fractional paise", async () => {
  const [a] = await accounts();
  await assert.rejects(
    transaction(async () => {
      const j = await insert(
        "INSERT INTO ledger_journals(event_key,event_type,source_id,description) VALUES($1,'sell',$2,'cross asset') RETURNING id",
        [id(), id()],
      );
      await db.query(
        "INSERT INTO ledger_entries(journal_id,account_id,asset_symbol,side,amount) VALUES($1,$2,'INR','debit',10)",
        [j.id, a.id],
      );
    }),
    /foreign key/,
  );
  const inr = await insert(
    "INSERT INTO ledger_accounts(code,asset_symbol,kind,bucket,normal_side) VALUES($1,'INR','asset','payout_clearing','debit') RETURNING id",
    [id()],
  );
  await assert.rejects(
    transaction(async () => {
      const j = await insert(
        "INSERT INTO ledger_journals(event_key,event_type,source_id,description) VALUES($1,'payout',$2,'precision') RETURNING id",
        [id(), id()],
      );
      await db.query(
        "INSERT INTO ledger_entries(journal_id,account_id,asset_symbol,side,amount) VALUES($1,$2,'INR','debit',1.001)",
        [j.id, inr.id],
      );
    }),
    /precision/,
  );
});
test("Scoped idempotency key rejects duplicate requests", async () => {
  const actor = id(),
    key = id();
  const sql =
    "INSERT INTO idempotency_keys(actor_id,scope,key,request_hash,expires_at) VALUES($1,'sell',$2,'test_digest',now()+interval '1 day')";
  await db.query(sql, [actor, key]);
  await assert.rejects(db.query(sql, [actor, key]), /unique/);
  await db.query(sql, [id(), key]);
});
test("Append-only audit trail rejects deletion", async () => {
  const a = await insert(
    "INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id) VALUES('service','test','test','test','test',$1) RETURNING id",
    [id()],
  );
  await assert.rejects(
    db.query("DELETE FROM audit_logs WHERE id=$1", [a.id]),
    /immutable/,
  );
});

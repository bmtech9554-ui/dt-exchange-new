import "reflect-metadata";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
const keys = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
Object.assign(process.env, {
  NODE_ENV: "test",
  OTP_PROVIDER: "dev",
  DEV_OTP_EXPOSE: "true",
  VERIFICATION_PROVIDER: "mock",
  MOCK_VERIFICATION_DECISION: "verified",
  RATE_PROVIDER: "mock",
  JWT_PRIVATE_KEY_B64: Buffer.from(keys.privateKey).toString("base64"),
  JWT_PUBLIC_KEY_B64: Buffer.from(keys.publicKey).toString("base64"),
  DATA_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  LOOKUP_HASH_KEY: randomBytes(32).toString("base64"),
  OTP_HASH_KEY: randomBytes(32).toString("base64"),
});
const { AppModule } = await import("../dist/app.module.js");
const { DatabaseService } = await import("../dist/common/database.service.js");
const { HttpErrorFilter } = await import(
  "../dist/common/http-exception.filter.js"
);
const { calculateRate, calculateFee, decimal } = await import(
  "../dist/modules/rates/money.js"
);
const { seedPhase3 } = await import("../scripts/seed-phase3.mjs");
let db, app, url, token, refresh, uid, bank, challenge, quote;
const password = "correct horse battery staple";
async function call(path, { method = "GET", body, auth = token, key } = {}) {
  const r = await fetch(url + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: "Bearer " + auth } : {}),
      ...(key ? { "idempotency-key": key } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
const post = (path, body, extra = {}) =>
  call(path, { method: "POST", body, ...extra });
before(async () => {
  db = new PGlite();
  for (const f of (
    await readdir(new URL("../migrations/", import.meta.url))
  ).sort())
    await db.exec(
      await readFile(new URL("../migrations/" + f, import.meta.url), "utf8"),
    );
  await db.exec(
    await readFile(
      new URL("../seeds/001_reference.sql", import.meta.url),
      "utf8",
    ),
  );
  await seedPhase3(db);
  // Use actual Nest controllers/guards/DTOs/services against PostgreSQL WASM.
  DatabaseService.prototype.query = function (sql, params = []) {
    return db.query(sql, params);
  };
  DatabaseService.prototype.transaction = function (fn) {
    return db.transaction((tx) => fn(tx));
  };
  app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: false,
    }),
  );
  const filter = new HttpErrorFilter();
  app.useGlobalFilters({
    catch(e, host) {
      if (!e.getStatus) console.error("TEST_ERROR", e.message);
      filter.catch(e, host);
    },
  });
  app.setGlobalPrefix("api/v1");
  await app.listen(0, "127.0.0.1");
  url = (await app.getUrl()) + "/api/v1";
});
after(async () => {
  await app?.close();
  await db?.close();
});
test("migration additions retain immutable snapshots and ownership", async () => {
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int n FROM information_schema.tables WHERE table_name='quote_states'",
      )
    ).rows[0].n,
    1,
  );
});
test("registration stores encrypted contacts and scrypt; no plaintext OTP", async () => {
  const r = await post(
    "/auth/register",
    {
      fullName: "Asha Nair",
      email: "asha@example.com",
      mobile: "+919876543210",
      password,
      termsAccepted: true,
    },
    { auth: null },
  );
  assert.equal(r.status, 201, JSON.stringify(r.data));
  challenge = r.data;
  const u = (await db.query("SELECT * FROM users")).rows[0];
  uid = u.id;
  assert.match(u.password_hash, /^scrypt\$/);
  assert.ok(!Buffer.from(u.email_ciphertext).toString().includes("asha"));
  assert.notEqual(
    (await db.query("SELECT code_hash FROM otp_challenges")).rows[0].code_hash,
    challenge.developmentOtp,
  );
});
test("OTP resend cooldown", async () => {
  assert.equal(
    (
      await post(
        "/auth/request-otp",
        { contact: "asha@example.com", purpose: "register" },
        { auth: null },
      )
    ).status,
    429,
  );
});
test("invalid OTP attempts persist", async () => {
  assert.equal(
    (
      await post(
        "/auth/verify-otp",
        {
          challengeId: challenge.challengeId,
          code: "000000",
          deviceId: "test-device",
        },
        { auth: null },
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await db.query("SELECT attempts FROM otp_challenges WHERE id=$1", [
        challenge.challengeId,
      ])
    ).rows[0].attempts,
    1,
  );
});
test("OTP consumption activates account and issues session; cannot reuse", async () => {
  const body = {
    challengeId: challenge.challengeId,
    code: challenge.developmentOtp,
    deviceId: "test-device",
  };
  const r = await post("/auth/verify-otp", body, { auth: null });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  token = r.data.accessToken;
  refresh = r.data.refreshToken;
  assert.equal(
    (await post("/auth/verify-otp", body, { auth: null })).status,
    401,
  );
});
test("profile reads actual account with simple badge", async () => {
  const r = await call("/users/me");
  assert.equal(r.data.fullName, "Asha Nair");
  assert.equal(r.data.verificationBadge, "Verification Required");
  assert.equal(r.data.accountStatus, "ACTIVE");
  assert.ok(!("password_hash" in r.data));
});
test("quote requires completed verification", async () => {
  assert.equal(
    (await post("/sell/quote", { amountUsdt: "100" }, { key: randomUUID() }))
      .status,
    403,
  );
});
test("verification adapters, review records and activation", async () => {
  const r = await post("/verification/start", {}, { key: randomUUID() });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  for (const v of r.data.records) {
    const result = await post(
      "/verification/submit",
      { verificationId: v.id },
      { key: randomUUID() },
    );
    assert.equal(result.status, 201, JSON.stringify(result.data));
  }
  assert.equal((await call("/users/me")).data.verificationStatus, "VERIFIED");
});
test("bank creation masks encrypted number and idempotent replay", async () => {
  const body = {
    accountHolderName: "Asha Nair",
    accountNumber: "123456789012",
    ifsc: "HDFC0001234",
    bankName: "HDFC Bank",
  };
  const key = randomUUID();
  const r = await post("/bank-accounts", body, { key });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  bank = r.data;
  assert.equal(bank.accountNumber, "XXXXXX9012");
  assert.equal(bank.isDefault, true);
  assert.equal((await post("/bank-accounts", body, { key })).data.id, bank.id);
  assert.equal(
    (await post("/bank-accounts", { ...body, bankName: "Other" }, { key }))
      .status,
    409,
  );
});
test("unauthorized bank access and unknown IDs", async () => {
  assert.equal(
    (await call("/bank-accounts/" + bank.id, { auth: null })).status,
    401,
  );
  assert.equal((await call("/bank-accounts/" + randomUUID())).status, 404);
});
test("default selection maintains one verified default", async () => {
  const r = await post(
    "/bank-accounts",
    {
      accountHolderName: "Asha Nair",
      accountNumber: "223456789012",
      ifsc: "HDFC0001234",
      bankName: "HDFC Bank",
    },
    { key: randomUUID() },
  );
  assert.equal(
    (
      await call("/bank-accounts/" + r.data.id + "/default", {
        method: "PATCH",
      })
    ).status,
    200,
  );
  const list = (await call("/bank-accounts")).data;
  assert.equal(list.filter((b) => b.isDefault).length, 1);
  assert.equal(list.find((b) => b.isDefault).id, r.data.id);
});
test("rate modes and exact integer fees", () => {
  const m = decimal("90", 8);
  assert.equal(
    calculateRate(m, "market_plus_margin", null, 100, 0),
    9090000000n,
  );
  assert.equal(
    calculateRate(m, "market_minus_margin", null, 100, 0),
    8910000000n,
  );
  assert.equal(calculateRate(m, "manual", 10000000000n, 0, 100), 9900000000n);
  assert.equal(calculateFee(10001n, 100n, 50), 151n);
});
test("rate API identifies development source", async () => {
  const r = await call("/rates/usdt-inr");
  assert.equal(r.status, 200);
  assert.equal(r.data.sandbox, true);
  assert.equal(r.data.exchangeRate, "92.45000000");
});
test("quote server calculation, immutable snapshot and idempotency", async () => {
  const key = randomUUID();
  const r = await post("/sell/quote", { amountUsdt: "100" }, { key });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  quote = r.data;
  assert.equal(quote.finalInrMinor, "919877");
  assert.equal(quote.feeInrMinor, "4623");
  assert.equal(
    (await post("/sell/quote", { amountUsdt: "100" }, { key })).data.quoteId,
    quote.quoteId,
  );
  assert.equal(
    (
      await post(
        "/sell/quote",
        { amountUsdt: "100", finalInr: "1" },
        { key: randomUUID() },
      )
    ).status,
    400,
  );
  await assert.rejects(
    db.query("UPDATE quotes SET rate_inr=1 WHERE id=$1", [quote.quoteId]),
    /immutable/,
  );
});
test("cancelled quotes cannot be consumed or reactivated", async () => {
  assert.equal(
    (await call("/sell/quote/" + quote.quoteId, { method: "DELETE" })).status,
    200,
  );
  assert.equal(
    (await call("/sell/quote/" + quote.quoteId)).data.status,
    "CANCELLED",
  );
  await assert.rejects(
    db.query("UPDATE quote_states SET status='ACTIVE' WHERE quote_id=$1", [
      quote.quoteId,
    ]),
    /forbidden/,
  );
  await assert.rejects(
    db.query(
      "INSERT INTO sell_orders(order_number,user_id,quote_id,bank_account_id,funding_source,funding_deadline) VALUES($1,$2,$3,$4,'onchain',now()+interval '1 hour')",
      [randomUUID(), uid, quote.quoteId, quote.bankAccountId],
    ),
    /unavailable/,
  );
});
test("minimum, maximum and account-specific daily limits", async () => {
  for (const amount of ["0", "9", "10001"])
    assert.equal(
      (await post("/sell/quote", { amountUsdt: amount }, { key: randomUUID() }))
        .status,
      400,
    );
  await db.query(
    "INSERT INTO user_limits(user_id,maximum_sell,daily_limit,monthly_limit) VALUES($1,100,100,100)",
    [uid],
  );
  assert.equal(
    (await post("/sell/quote", { amountUsdt: "80" }, { key: randomUUID() }))
      .status,
    201,
  );
  assert.equal(
    (await post("/sell/quote", { amountUsdt: "30" }, { key: randomUUID() }))
      .status,
    400,
  );
});
test("invalid login, valid password login and session list", async () => {
  assert.equal(
    (
      await post(
        "/auth/login",
        {
          contact: "asha@example.com",
          password: "wrong-pass",
          deviceId: "device-two",
        },
        { auth: null },
      )
    ).status,
    401,
  );
  const r = await post(
    "/auth/login",
    { contact: "asha@example.com", password, deviceId: "device-two" },
    { auth: null },
  );
  assert.equal(r.status, 201);
  assert.equal((await call("/sessions")).data.length, 2);
});
test("authenticated mobile verification enables mobile password and OTP login", async () => {
  await db.query("DELETE FROM rate_limit_buckets");
  const r = await post("/auth/contact/request-otp", {
    contact: "+919876543210",
  });
  assert.equal(r.status, 201);
  const body = {
    challengeId: r.data.challengeId,
    code: r.data.developmentOtp,
    deviceId: "mobile-device",
  };
  assert.equal(
    (await post("/auth/verify-otp", body, { auth: null })).status,
    401,
  );
  assert.equal((await post("/auth/contact/verify-otp", body)).status, 201);
  assert.equal(
    (
      await post(
        "/auth/login",
        { contact: "+919876543210", password, deviceId: "mobile-device" },
        { auth: null },
      )
    ).status,
    201,
  );
  await db.query("DELETE FROM rate_limit_buckets");
  const loginOtp = await post(
    "/auth/request-otp",
    { contact: "+919876543210", purpose: "login" },
    { auth: null },
  );
  assert.equal(
    (
      await post(
        "/auth/verify-otp",
        {
          challengeId: loginOtp.data.challengeId,
          code: loginOtp.data.developmentOtp,
          deviceId: "mobile-otp-device",
        },
        { auth: null },
      )
    ).status,
    201,
  );
});
test("refresh rotation and replay revoke entire family", async () => {
  const r = await post(
    "/auth/refresh",
    { refreshToken: refresh },
    { auth: null },
  );
  assert.equal(r.status, 201);
  assert.notEqual(r.data.refreshToken, refresh);
  assert.equal(
    (await call("/users/me", { auth: r.data.accessToken })).status,
    200,
  );
  assert.equal(
    (await post("/auth/refresh", { refreshToken: refresh }, { auth: null }))
      .status,
    401,
  );
  assert.equal(
    (await call("/users/me", { auth: r.data.accessToken })).status,
    401,
  );
});
test("OTP expiry and attempt limit", async () => {
  await db.query("DELETE FROM rate_limit_buckets");
  const r = await post(
    "/auth/request-otp",
    { contact: "asha@example.com", purpose: "login" },
    { auth: null },
  );
  await db.query(
    "UPDATE otp_challenges SET expires_at=now()-interval '1 second' WHERE id=$1",
    [r.data.challengeId],
  );
  assert.equal(
    (
      await post(
        "/auth/verify-otp",
        {
          challengeId: r.data.challengeId,
          code: r.data.developmentOtp,
          deviceId: "device-two",
        },
        { auth: null },
      )
    ).status,
    401,
  );
});
test("quote expiry is reported and acceptance fails after all migrations", async () => {
  const old = (await db.query("SELECT * FROM quotes LIMIT 1")).rows[0];
  const expired = (
    await db.query(
      "INSERT INTO quotes(user_id,bank_account_id,funding_source,amount_usdt,rate_inr,gross_inr_minor,fee_inr_minor,net_inr_minor,exchange_rate_id,fee_id,rate_policy_id,created_at,expires_at) VALUES($1,$2,'onchain',$3,$4,$5,$6,$7,$8,$9,$10,now()-interval '5 minutes',now()-interval '1 minute') RETURNING id",
      [
        old.user_id,
        old.bank_account_id,
        old.amount_usdt,
        old.rate_inr,
        old.gross_inr_minor,
        old.fee_inr_minor,
        old.net_inr_minor,
        old.exchange_rate_id,
        old.fee_id,
        old.rate_policy_id,
      ],
    )
  ).rows[0];
  const login = await post(
    "/auth/login",
    { contact: "asha@example.com", password, deviceId: "device-three" },
    { auth: null },
  );
  token = login.data.accessToken;
  assert.equal(
    (await call("/sell/quote/" + expired.id)).data.status,
    "EXPIRED",
  );
  await assert.rejects(
    db.query(
      "INSERT INTO sell_orders(order_number,user_id,quote_id,bank_account_id,funding_source,funding_deadline) VALUES($1,$2,$3,$4,'onchain',now()+interval '1 hour')",
      [randomUUID(), uid, expired.id, old.bank_account_id],
    ),
    /expired/,
  );
});
test("OTP five wrong attempts lock challenge even with correct code", async () => {
  await db.query("DELETE FROM rate_limit_buckets");
  const r = await post(
    "/auth/request-otp",
    { contact: "asha@example.com", purpose: "login" },
    { auth: null },
  );
  const body = {
    challengeId: r.data.challengeId,
    code: "000000",
    deviceId: "attempt-device",
  };
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await post("/auth/verify-otp", body, { auth: null })).status,
      401,
    );
  assert.equal(
    (
      await post(
        "/auth/verify-otp",
        { ...body, code: r.data.developmentOtp },
        { auth: null },
      )
    ).status,
    401,
  );
});
test("cross-user bank and quote authorization prevents IDOR", async () => {
  await db.query("DELETE FROM rate_limit_buckets");
  const r = await post(
    "/auth/register",
    {
      fullName: "Another User",
      email: "another@example.com",
      mobile: "+919876543211",
      password,
      termsAccepted: true,
    },
    { auth: null },
  );
  const login = await post(
    "/auth/verify-otp",
    {
      challengeId: r.data.challengeId,
      code: r.data.developmentOtp,
      deviceId: "other-device",
    },
    { auth: null },
  );
  const auth = login.data.accessToken;
  assert.equal((await call("/bank-accounts/" + bank.id, { auth })).status, 404);
  assert.equal(
    (
      await call("/bank-accounts/" + bank.id + "/default", {
        method: "PATCH",
        auth,
      })
    ).status,
    404,
  );
  assert.equal(
    (await call("/bank-accounts/" + bank.id, { method: "DELETE", auth }))
      .status,
    404,
  );
  assert.equal(
    (await call("/sell/quote/" + quote.quoteId, { auth })).status,
    404,
  );
});
test("logout other devices leaves current session usable", async () => {
  assert.equal((await post("/sessions/logout-others", {})).status, 201);
  assert.equal((await call("/sessions")).data.length, 1);
  assert.equal((await call("/users/me")).status, 200);
});
test("monthly usage includes prior-day active quotes and blocks a new quote", async () => {
  const old = (
    await db.query(
      "SELECT q.* FROM quotes q JOIN quote_states s ON s.quote_id=q.id WHERE s.status='ACTIVE' AND q.expires_at>now() LIMIT 1",
    )
  ).rows[0];
  assert.ok(old);
  await db.query(
    "INSERT INTO quotes(user_id,bank_account_id,funding_source,amount_usdt,rate_inr,gross_inr_minor,fee_inr_minor,net_inr_minor,exchange_rate_id,fee_id,rate_policy_id,created_at,expires_at) VALUES($1,$2,'onchain',$3,$4,$5,$6,$7,$8,$9,$10,date_trunc('month',now())+interval '1 hour',now()+interval '1 minute')",
    [
      old.user_id,
      old.bank_account_id,
      old.amount_usdt,
      old.rate_inr,
      old.gross_inr_minor,
      old.fee_inr_minor,
      old.net_inr_minor,
      old.exchange_rate_id,
      old.fee_id,
      old.rate_policy_id,
    ],
  );
  assert.equal(
    (await post("/sell/quote", { amountUsdt: "10" }, { key: randomUUID() }))
      .status,
    400,
  );
});
test("order acceptance atomically consumes an active quote once", async () => {
  const q = (
    await db.query(
      "SELECT q.* FROM quotes q JOIN quote_states s ON s.quote_id=q.id WHERE s.status='ACTIVE' AND q.expires_at>now() LIMIT 1",
    )
  ).rows[0];
  const insert = () =>
    db.query(
      "INSERT INTO sell_orders(order_number,user_id,quote_id,bank_account_id,funding_source,funding_deadline) VALUES($1,$2,$3,$4,'onchain',now()+interval '1 hour')",
      [randomUUID(), uid, q.id, q.bank_account_id],
    );
  await insert();
  assert.equal(
    (
      await db.query("SELECT status FROM quote_states WHERE quote_id=$1", [
        q.id,
      ])
    ).rows[0].status,
    "USED",
  );
  await assert.rejects(insert(), /unavailable|duplicate/);
});
test("forgot/reset password grant is single-use; resets revoke all sessions", async () => {
  await db.query("DELETE FROM rate_limit_buckets");
  const r = await post(
    "/auth/forgot-password",
    { contact: "asha@example.com" },
    { auth: null },
  );
  const verified = await post(
    "/auth/verify-otp",
    {
      challengeId: r.data.challengeId,
      code: r.data.developmentOtp,
      deviceId: "reset-device",
    },
    { auth: null },
  );
  assert.ok(verified.data.resetToken);
  const body = {
    resetToken: verified.data.resetToken,
    password: "new password for testing only",
  };
  assert.equal(
    (await post("/auth/reset-password", body, { auth: null })).status,
    201,
  );
  assert.equal((await call("/users/me")).status, 401);
  assert.equal(
    (await post("/auth/reset-password", body, { auth: null })).status,
    400,
  );
  assert.equal(
    (
      await post(
        "/auth/login",
        { contact: "asha@example.com", password, deviceId: "test-device" },
        { auth: null },
      )
    ).status,
    401,
  );
  const login = await post(
    "/auth/login",
    {
      contact: "asha@example.com",
      password: body.password,
      deviceId: "test-device",
    },
    { auth: null },
  );
  assert.equal(login.status, 201);
  token = login.data.accessToken;
});
test("change password requires current credential and logs out current device", async () => {
  assert.equal(
    (
      await post("/auth/change-password", {
        currentPassword: "wrong password",
        password: "another sufficiently long password",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await post("/auth/change-password", {
        currentPassword: "new password for testing only",
        password: "another sufficiently long password",
      })
    ).status,
    201,
  );
  assert.equal((await call("/users/me")).status, 401);
});
test("production rejects sandbox and missing secrets", async () => {
  const { readEnvironment } = await import("../dist/config/environment.js");
  assert.throws(() => readEnvironment({ NODE_ENV: "production" }));
  assert.throws(
    () =>
      readEnvironment({
        ...process.env,
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://db/x",
        CORS_ORIGINS: "https://example.com",
      }),
    /Development providers/,
  );
});

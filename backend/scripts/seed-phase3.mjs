import pg from "pg";
export async function seedPhase3(db) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Development seed forbidden in production");
  await db.query(
    "INSERT INTO fees(version,flat_inr_minor,basis_points,effective_from) VALUES(1,0,50,now()) ON CONFLICT(version) DO NOTHING",
  );
  await db.query(
    "INSERT INTO rate_policies(version,mode,margin_bps,minimum_sell,maximum_sell,daily_limit,monthly_limit,quote_expiry_seconds,maximum_rate_age_seconds,fee_id,effective_from) SELECT 1,'market',0,10,10000,20000,100000,90,120,id,now() FROM fees WHERE version=1 ON CONFLICT(version) DO NOTHING",
  );
}
if (process.argv[1]?.endsWith("seed-phase3.mjs")) {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await db.connect();
    await seedPhase3(db);
  } finally {
    await db.end();
  }
}

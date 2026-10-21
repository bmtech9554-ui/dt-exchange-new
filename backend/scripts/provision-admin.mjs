import "reflect-metadata";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { CryptoService } from "../dist/common/crypto.service.js";
const {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_TOTP_SECRET,
  DATABASE_URL,
  NODE_ENV,
} = process.env;
if (
  !ADMIN_EMAIL ||
  !ADMIN_PASSWORD ||
  ADMIN_PASSWORD.length < 16 ||
  !DATABASE_URL
)
  throw new Error(
    "Provide ADMIN_EMAIL, ADMIN_PASSWORD (16+ characters), DATABASE_URL via a secure environment",
  );
if (
  NODE_ENV === "production" &&
  (!ADMIN_TOTP_SECRET || !/^[A-Z2-7]{32,128}$/.test(ADMIN_TOTP_SECRET))
)
  throw new Error("Production requires an enrolled base32 ADMIN_TOTP_SECRET");
const db = new pg.Client({ connectionString: DATABASE_URL }),
  crypto = new CryptoService(),
  id = randomUUID();
try {
  await db.connect();
  await db.query("BEGIN");
  await db.query(
    "INSERT INTO admin_role_permissions(role_id,permission_code) SELECT id,p FROM admin_roles CROSS JOIN unnest(ARRAY['orders.read','deposits.read','reviews.read','reviews.acknowledge']) p WHERE name='operations' ON CONFLICT DO NOTHING",
  );
  await db.query(
    "INSERT INTO admin_users(id,email_lookup_hash,email_ciphertext,password_hash,totp_secret_ciphertext,status) VALUES($1,$2,$3,$4,$5,'active')",
    [
      id,
      crypto.digest(ADMIN_EMAIL.trim().toLowerCase(), "email"),
      crypto.encrypt(ADMIN_EMAIL, "admin-email:" + id),
      await crypto.password(ADMIN_PASSWORD),
      ADMIN_TOTP_SECRET
        ? crypto.encrypt(ADMIN_TOTP_SECRET, "admin-totp:" + id)
        : null,
    ],
  );
  const role=process.env.ADMIN_ROLE??'operations';
  const allowed=['operations','treasury','support','engagement','observer','notification-manager','referral-manager','financial-monitor','verification-reviewer','system-operator','reconciliation-operator','account-operator','super-admin'];
  if(!allowed.includes(role)||role==='super-admin'&&process.env.ADMIN_BREAK_GLASS_APPROVED!=='explicit-provisioning')throw new Error('Explicit role authorization required');
  const grant=await db.query('INSERT INTO admin_user_roles(admin_user_id,role_id) SELECT $1,id FROM admin_roles WHERE name=$2 RETURNING role_id',[id,role]);
  if(grant.rowCount!==1)throw new Error('Role unavailable');
  await db.query("INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES('service','secure-provisioner','admin.provisioned','admin',$1,gen_random_uuid(),$2)",[id,JSON.stringify({role})]);
  await db.query("COMMIT");
  console.log("Operations administrator provisioned. No credentials printed.");
} catch {
  await db.query("ROLLBACK");
  process.exitCode = 1;
  console.error(
    "Admin provisioning failed; inspect configuration without logging secrets.",
  );
} finally {
  await db.end();
}

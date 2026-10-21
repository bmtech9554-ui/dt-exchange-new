import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {ensureSimulationCapabilities} from './public-test-capabilities.mjs';
const require=createRequire(import.meta.url);
const {assertPublicTestIsolation,TEST_ADDRESS}=require('../dist/public-test/isolation.js');
export async function initializePublicTest(db) {
  assertPublicTestIsolation();
  const existing=(await db.query("SELECT to_regclass('public.users') name")).rows[0].name;
  const bootstrap=(await db.query("SELECT to_regclass('public.public_test_bootstrap') name")).rows[0].name;
  if(existing) {
    const marker=(await db.query("SELECT value FROM system_settings WHERE key='public_software_test'")).rows[0]?.value;
    if(marker?.mode==='PUBLIC_SOFTWARE_TEST'&&marker.realMoney===false){await ensureSimulationCapabilities(db);return;}
    if(!bootstrap)throw new Error('REFUSE_EXISTING_DATABASE');
  }
  if(!bootstrap){
    if((await db.query("SELECT count(*)::int n FROM pg_tables WHERE schemaname='public'")).rows[0].n!==0)throw new Error('EMPTY_TEST_DATABASE_REQUIRED');
    await db.exec("CREATE TABLE public_test_bootstrap(id int PRIMARY KEY CHECK(id=1),mode text NOT NULL CHECK(mode='PUBLIC_SOFTWARE_TEST')); INSERT INTO public_test_bootstrap VALUES(1,'PUBLIC_SOFTWARE_TEST')");
  }
  if((await db.query('SELECT mode FROM public_test_bootstrap WHERE id=1')).rows[0]?.mode!=='PUBLIC_SOFTWARE_TEST')throw new Error('INVALID_TEST_BOOTSTRAP');
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
  // Commit every migration separately, as the official migrator does. PostgreSQL
  // enum additions cannot be used until their transaction has committed.
  for(const name of (await readdir(new URL('../migrations/',import.meta.url))).filter(n=>/^\d.*\.sql$/.test(n)).sort()){
    const source=await readFile(new URL('../migrations/'+name,import.meta.url),'utf8');
    const checksum=createHash('sha256').update(source).digest('hex');
    const applied=(await db.query('SELECT checksum FROM schema_migrations WHERE name=$1',[name])).rows[0];
    if(applied){if(applied.checksum!==checksum)throw new Error('TEST_MIGRATION_CHECKSUM_CHANGED');continue;}
    await db.exec('BEGIN');
    try{await db.exec(source);await db.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',[name,checksum]);await db.exec('COMMIT');}
    catch(e){await db.exec('ROLLBACK');throw e;}
  }
  await db.exec('BEGIN');
  try{
    await db.exec(await readFile(new URL('../seeds/001_reference.sql',import.meta.url),'utf8'));
    await (await import('./seed-phase4.mjs')).seedPhase4(db);
    await db.query("INSERT INTO fees(version,flat_inr_minor,basis_points,effective_from) VALUES(1,0,0,now())");
    await db.query("INSERT INTO rate_policies(version,mode,manual_rate,margin_bps,spread_bps,minimum_sell,maximum_sell,daily_limit,monthly_limit,quote_expiry_seconds,maximum_rate_age_seconds,fee_id,effective_from) SELECT 1,'manual',103,0,0,100,5000,20000,100000,60,120,id,now() FROM fees WHERE version=1");
    const settings={
      public_software_test:{mode:'PUBLIC_SOFTWARE_TEST',realMoney:false},
      manual_deposit_wallet:{address:TEST_ADDRESS,network:'TRC20',asset:'USDT'},
      manual_deposit_policy:{minimumDeposit:'100',dailyDepositLimit:'20000',monthlyDepositLimit:null,monthlyLimitEnabled:false,depositFeeUsdt:'0'},
      operational_controls:{mode:'NORMAL',registrations:true,deposits:true,sell:true,payouts:true,referrals:false,notifications:true,support:true},
      owner_maintenance:{app:false,api:false,website:false,message:'Test service maintenance'},
    };
    for(const [key,value]of Object.entries(settings))await db.query('INSERT INTO system_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[key,JSON.stringify(value)]);
    await db.exec(`
      CREATE TABLE public_test_references(tx_hash text PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE public_test_capacity(id int PRIMARY KEY,users int NOT NULL DEFAULT 0,bytes bigint NOT NULL DEFAULT 0);
      INSERT INTO public_test_capacity(id) VALUES(1);
      CREATE FUNCTION public_test_user_cap() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        UPDATE public_test_capacity SET users=users+1 WHERE id=1 AND users<1000;
        IF NOT FOUND THEN RAISE EXCEPTION 'TEST_CAPACITY_REACHED'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER test_users_cap BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION public_test_user_cap();
      CREATE FUNCTION public_test_deposit_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.receiver<>'${TEST_ADDRESS}' OR NEW.network_code<>'tron-mock' OR NOT EXISTS(SELECT 1 FROM public_test_references WHERE tx_hash=NEW.tx_hash AND user_id=NEW.user_id) THEN RAISE EXCEPTION 'TEST_REFERENCE_REQUIRED'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER test_deposit_guard BEFORE INSERT ON manual_deposit_requests FOR EACH ROW EXECUTE FUNCTION public_test_deposit_guard();
      CREATE FUNCTION public_test_bank_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.ifsc<>'DEMO0000000' OR NEW.bank_name<>'DEMO NON-PAYABLE BANK' OR NEW.last_four<>'0000' THEN RAISE EXCEPTION 'DEMO_BANK_ONLY'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER test_bank_guard BEFORE INSERT OR UPDATE ON bank_accounts FOR EACH ROW EXECUTE FUNCTION public_test_bank_guard();
      CREATE FUNCTION public_test_file_cap() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE n bigint; BEGIN
        n=octet_length(NEW.payload_ciphertext);
        IF NEW.size_bytes>1048576 THEN RAISE EXCEPTION 'TEST_FILE_MAX_1MB'; END IF;
        UPDATE public_test_capacity SET bytes=bytes+n WHERE id=1 AND bytes+n<=1073741824;
        IF NOT FOUND THEN RAISE EXCEPTION 'TEST_STORAGE_CAPACITY_REACHED'; END IF;
        IF (SELECT count(*) FROM private_financial_files WHERE user_id=NEW.user_id)>19 THEN RAISE EXCEPTION 'TEST_USER_FILE_CAP'; END IF;
        RETURN NEW; END $$;
      CREATE TRIGGER test_file_cap BEFORE INSERT ON private_financial_files FOR EACH ROW EXECUTE FUNCTION public_test_file_cap();
      ALTER TABLE admin_users ADD CONSTRAINT public_test_admin_mfa CHECK(totp_secret_ciphertext IS NOT NULL);
    `);
    await db.exec('COMMIT');
  }catch(e){await db.exec('ROLLBACK');throw e;}
  await ensureSimulationCapabilities(db);
}
if(process.argv[1]?.endsWith('public-test-initialize.mjs')){
  const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();db.exec=s=>db.query(s);
  try{await initializePublicTest(db);console.log('PUBLIC_TEST_DATABASE_READY');}finally{await db.end();}
}

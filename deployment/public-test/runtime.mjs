// Fresh test-only keys/config, mounted read-only. Never load production runtime.env.
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const cfg=JSON.parse(readFileSync('/test-secrets/runtime.json','utf8'));
// Container environment contains no production credentials; explicit fresh test
// values are set before importing any Nest module or database pool.
Object.assign(process.env,cfg);
const {assertPublicTestIsolation}=require('/app/backend/dist/public-test/isolation.js');assertPublicTestIsolation();
if(process.argv[2]==='initialize')await import('/app/backend/scripts/public-test-initialize.mjs').then(async({initializePublicTest})=>{const {Client}=await import('pg');const db=new Client({connectionString:process.env.DATABASE_URL});await db.connect();db.exec=s=>db.query(s);try{await initializePublicTest(db);}finally{await db.end();}});
else await require('/app/backend/dist/public-test/main.js').createPublicTestApp().then(app=>app.listen(4118,'0.0.0.0'));

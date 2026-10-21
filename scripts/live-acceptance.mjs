// Refuses absent infrastructure; never silently substitutes PGlite for this command.
import {spawnSync} from 'node:child_process';
if(process.env.DEPLOYMENT_ENV!=='staging'||!process.env.PHASE6_POSTGRES_URL||!process.env.PHASE6_REDIS_URL)throw new Error('Explicit isolated staging PostgreSQL and Redis URLs required');
const db=new URL(process.env.PHASE6_POSTGRES_URL),redis=new URL(process.env.PHASE6_REDIS_URL);
if(!/^\/dt_phase6_test(?:_[a-z0-9]+)?$/.test(db.pathname)||!/^\/(?:[1-9]|1[0-5])$/.test(redis.pathname))throw new Error('Dedicated test database names required');
const result=spawnSync(process.execPath,['--test','backend/test/phase6.test.mjs','backend/test/phase7.test.mjs','backend/test/phase8-e2e.test.mjs','backend/test/redis-integration.mjs','backend/test/phase8-redis-recovery.mjs'],{stdio:'inherit',env:process.env,timeout:300000});
process.exitCode=result.status??1;

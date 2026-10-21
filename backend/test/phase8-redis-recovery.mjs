// Explicit opt-in; synthetic jobs only, unique queue, never flush shared Redis.
import {test} from 'node:test';import assert from 'node:assert/strict';import {Queue,Worker,QueueEvents} from 'bullmq';import {randomUUID} from 'node:crypto';
test('RC1 Redis worker stop, queue, restart and duplicate job recovery',{skip:!process.env.PHASE6_REDIS_URL,timeout:25000},async()=>{
 const u=new URL(process.env.PHASE6_REDIS_URL);if(!['redis:','rediss:'].includes(u.protocol)||!/^\/(?:[1-9]|1[0-5])$/.test(u.pathname))throw new Error('Isolated Redis database 1-15 required');
 const connection={host:u.hostname,port:Number(u.port||6379),username:u.username||undefined,password:decodeURIComponent(u.password)||undefined,db:Number(u.pathname.slice(1)),maxRetriesPerRequest:null,connectTimeout:5000,...(u.protocol==='rediss:'?{tls:{rejectUnauthorized:true}}:{})};
 const name='dt-rc1-'+randomUUID(),q=new Queue(name,{connection}),events=new QueueEvents(name,{connection});let worker;const processed=new Set();let calls=0;
 try{await events.waitUntilReady();worker=new Worker(name,async job=>{calls++;processed.add(job.id);return 'done';},{connection});await worker.close();worker=undefined;
 const job=await q.add('synthetic',{}, {jobId:'stable-id',removeOnComplete:false});await q.add('synthetic',{}, {jobId:'stable-id'});
 assert.equal(await q.getWaitingCount(),1);
 worker=new Worker(name,async job=>{calls++;processed.add(job.id);return 'done';},{connection});assert.equal(await job.waitUntilFinished(events,10000),'done');assert.equal(calls,1);assert.equal(processed.size,1);
 }finally{await worker?.close();await events.close();await q.obliterate({force:true});await q.close();}
});

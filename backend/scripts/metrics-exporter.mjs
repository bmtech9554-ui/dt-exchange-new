/** Private monitoring listener. Bind on a private monitoring network; never proxy publicly. */
import http from 'node:http';
import {Queue} from 'bullmq';
import {redisConnection,queuePrefix,engagementQueueName} from '../dist/common/queue-config.js';
import pg from 'pg';
const db=new pg.Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:3000,statement_timeout:5000});
const queues=process.env.REDIS_URL?[engagementQueueName(),...(process.env.TRANSACTIONS_ENABLED==='true'?['dt-blockchain']:[]),...(process.env.PAYOUTS_ENABLED==='true'?['dt-payouts']:[])].map(name=>{const q=new Queue(name,{prefix:queuePrefix(),connection:{...redisConnection(),maxRetriesPerRequest:1,enableOfflineQueue:false}});q.on('error',()=>{});return q;}):[];
const queries={
 dt_blockchain_scan_lag_seconds:"SELECT COALESCE(max(extract(epoch FROM now()-COALESCE(last_scan_at,to_timestamp(0)))),0)::text value FROM chain_scan_cursors",
 dt_ledger_mismatches:"SELECT count(*)::text value FROM ledger_integrity_issues",
 dt_reconciliation_mismatches:"SELECT count(*)::text value FROM reconciliation_issues WHERE status IN ('MISMATCH','MISSING_INTERNAL','MISSING_PROVIDER','MANUAL_REVIEW')",
 dt_worker_stale:"SELECT count(*)::text value FROM unnest(ARRAY['engagement','blockchain','payouts']) required(worker) LEFT JOIN worker_heartbeats w USING(worker) WHERE w.worker IS NULL OR last_seen_at<now()-interval '2 minutes' OR state<>'ok'",
 dt_payout_pending:"SELECT count(*)::text value FROM payouts WHERE lifecycle IN ('QUEUED','SUBMITTED','PROCESSING')",
 dt_payout_failed:"SELECT count(*)::text value FROM payouts WHERE lifecycle='FAILED' AND updated_at>now()-interval '1 hour'",
 dt_payout_oldest_seconds:"SELECT COALESCE(extract(epoch FROM now()-min(created_at)),0)::text value FROM payouts WHERE lifecycle IN ('QUEUED','SUBMITTED','PROCESSING')",
 dt_notification_failed:"SELECT count(*)::text value FROM notification_deliveries WHERE status='FAILED'",
 dt_support_backlog:"SELECT count(*)::text value FROM support_tickets WHERE status IN ('open','in_progress','waiting_for_user')",
 dt_provider_circuit_open:"SELECT count(*)::text value FROM provider_circuits WHERE opened_until>now()",
 dt_db_connections:"SELECT count(*)::text value FROM pg_stat_activity WHERE datname=current_database()",
 dt_api_latency_ms:"SELECT COALESCE(avg(value),0)::text value FROM metric_samples WHERE name='api_latency_ms' AND created_at>now()-interval '5 minutes'",
 dt_api_error_ratio:"SELECT COALESCE(avg(CASE WHEN labels->>'result'='error' THEN 1 ELSE 0 END),0)::text value FROM metric_samples WHERE name='api_latency_ms' AND created_at>now()-interval '5 minutes'"
};
const server=http.createServer(async(req,res)=>{if(req.url!=='/metrics'){res.writeHead(404).end();return;}try{const lines=['dt_metrics_available 1'];for(const [name,sql]of Object.entries(queries)){const v=(await db.query(sql)).rows[0].value;if(!/^-?\d+(\.\d+)?$/.test(v))throw new Error();lines.push(`# TYPE ${name} gauge`,`${name} ${v}`);}for(const q of queues)lines.push(await q.exportPrometheusMetrics());res.writeHead(200,{'content-type':'text/plain; version=0.0.4'}).end(lines.join('\n')+'\n');}catch{res.writeHead(503).end('dt_metrics_available 0\n');}});
server.listen(Number(process.env.METRICS_PORT??9108),process.env.METRICS_HOST??'127.0.0.1');
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{server.close(()=>void Promise.all([db.end(),...queues.map(q=>q.close())]));});

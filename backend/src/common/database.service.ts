import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Pool, QueryResultRow } from "pg";
export interface SqlClient {
  query<T extends QueryResultRow = Record<string, any>>(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
}
@Injectable()
export class DatabaseService implements SqlClient, OnModuleDestroy {
  private readonly pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        max: Number(process.env.PG_POOL_MAX ?? 10),
        application_name: process.env.SERVICE_NAME ?? 'dt-exchange',
        idleTimeoutMillis: 30000,
        statement_timeout: 10000,
        idle_in_transaction_session_timeout: 15000,
        connectionTimeoutMillis: 5000,
        query_timeout: 10000,
      })
    : undefined;
  constructor() {
    const max=Number(process.env.PG_POOL_MAX??10);
    if(!Number.isInteger(max)||max<1||max>100)throw new Error("INVALID_PG_POOL_MAX");
    this.pool?.on("error", () =>
      console.error(JSON.stringify({ event: "database_connection_error" })),
    );
  }
  async query<T extends QueryResultRow = Record<string, any>>(
    sql: string,
    values: unknown[] = [],
  ) {
    if (!this.pool) throw new ServiceUnavailableException();
    return this.pool.query<T>(sql, values);
  }
  async transaction<T>(body: (tx: SqlClient) => Promise<T>): Promise<T> {
    if (!this.pool) throw new ServiceUnavailableException();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SET LOCAL statement_timeout = '10s'");
      await client.query("SET LOCAL idle_in_transaction_session_timeout = '15s'");
      const result = await body(client);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  async ready() {
    try {
      return (
        (
          await this.query(
            process.env.MANUAL_DEPOSIT_REVIEW === "true" || process.env.MANUAL_PAYOUT === "true" ? "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name='009_manual_identity_optional.sql') AND EXISTS(SELECT 1 FROM assets WHERE symbol='USDT' AND ledger_decimals=18) AND EXISTS(SELECT 1 FROM assets WHERE symbol='INR' AND ledger_decimals=2) AS ready" : "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name='007_operational_readiness.sql') AS ready",
          )
        ).rows[0]?.ready === true
      );
    } catch {
      return false;
    }
  }
  async onModuleDestroy() {
    await this.pool?.end();
  }
}

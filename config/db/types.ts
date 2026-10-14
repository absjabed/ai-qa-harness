/**
 * The contract between `config/DbConnection.ts` and each database engine it supports.
 *
 * Everything above this layer — page objects, `data/seed.ts`, the readiness check — talks to
 * `DbConnection` and never to a driver, so a project moves engine by changing `DB_ENGINE` in `.env`
 * and the dialect of its own queries, not its code.
 */

/** Engines the harness ships an adapter for. */
export type DbEngine = 'mssql' | 'postgres';

/** What every adapter returns, whatever its driver calls things. */
export interface QueryResult<Row = Record<string, any>> {
    /** Result rows. */
    rows: Row[];
    /**
     * The same array as `rows`. Kept so code written against the original SQL Server-only harness,
     * which used the `mssql` driver's name for it, keeps working.
     */
    recordset: Row[];
    /** Rows changed by an INSERT, UPDATE or DELETE; for a SELECT, the rows returned. */
    rowCount: number;
}

/** An open connection to one engine. */
export interface DbAdapter {
    /**
     * Run one statement. Named parameters are written `@name` in the SQL for every engine — each
     * adapter translates that into its driver's own placeholder style.
     */
    query(sql: string, params?: Record<string, unknown>): Promise<QueryResult>;
    close(): Promise<void>;
}

/** What `DbConnection` needs to know about an engine to explain its failures. */
export interface EngineErrors {
    /** True for a refusal that will not clear by itself: a firewall rule, bad credentials, a missing database. */
    isPersistentRefusal(error: unknown): boolean;
    /** Lines saying what is wrong and what to do, after the driver's own first line. Empty if nothing specific applies. */
    explain(error: unknown): string[];
}

/** First line of a driver error, without its stack. */
export function errorMessage(error: unknown): string {
    return String((error as { message?: string })?.message ?? error);
}

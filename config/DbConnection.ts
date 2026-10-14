import { appConfig } from './testConfig';
import { connectMssql, mssqlErrors } from './db/mssqlAdapter';
import { connectPostgres, postgresErrors } from './db/postgresAdapter';
import { errorMessage, type DbAdapter, type DbEngine, type EngineErrors, type QueryResult } from './db/types';

export type { QueryResult } from './db/types';

/** The engines this harness can talk to, chosen by `DB_ENGINE` in `.env`. */
const ENGINES: Record<DbEngine, { label: string; connect: typeof connectMssql; errors: EngineErrors }> = {
    mssql: { label: 'SQL Server', connect: connectMssql, errors: mssqlErrors },
    postgres: { label: 'PostgreSQL', connect: connectPostgres, errors: postgresErrors },
};

/**
 * Set once the server has refused us for a reason that will not clear on its own — a firewall rule
 * that does not cover this machine's IP, or bad credentials. Every later connection attempt in this
 * worker then fails immediately instead of sitting through its own connect timeout.
 *
 * Without this, a blocked IP costs the full connect timeout *per test*. A suite of any size then
 * spends its whole run failing every test for one environmental reason, and the report has to be
 * read carefully to notice the cause is not N separate regressions.
 *
 * Deliberately NOT latched for transient faults (dropped socket, momentary timeout) — those can
 * recover within a run, and latching on them would let one blip void everything after it.
 */
let blockingConnectionFailure: string | null = null;

/** Marks a "you haven't configured this" error, so callers can print it without a driver stack. */
const CONFIG_ERROR_PREFIX = 'Database is not configured';

/**
 * Catch an unconfigured environment before handing it to the driver.
 *
 * Without this, an unset DB_SERVER reaches the driver as an empty host and comes back as
 * "Failed to connect to :1433" under a wall of driver frames — which reads like an outage rather
 * than a missing `.env`, and sends people looking at the network instead of their own config.
 */
function assertDbConfigured(): void {
    const { db } = appConfig;

    if (!(db.engine in ENGINES)) {
        throw new Error(
            `${CONFIG_ERROR_PREFIX}: DB_ENGINE is '${db.engine}'.\n` +
            `  Set it to one of: ${Object.keys(ENGINES).join(', ')}.`
        );
    }

    const missing = (
        [
            ['DB_SERVER', db.server],
            ['DB_NAME', db.database],
            ['DB_USER', db.user],
            ['DB_PASSWORD', db.password],
        ] as const
    )
        .filter(([, value]) => !value)
        .map(([name]) => name);

    if (missing.length > 0) {
        throw new Error(
            `${CONFIG_ERROR_PREFIX}: ${missing.join(', ')} not set in .env.\n` +
            '  Copy .env.example to .env and fill in the DB_* block — see SETUP.md step 2.\n' +
            '  If this project has no database, set DB_VALIDATION_ENABLED=false and remove the\n' +
            '  DB-backed assertions from your page objects.'
        );
    }
}

/**
 * Turn the driver's error into something that says what is wrong and what to do about it. The raw
 * error is a wall of driver stack frames in which the one useful sentence is easy to miss.
 */
function explainConnectionFailure(error: unknown, errors: EngineErrors, label: string): string {
    const firstLine = errorMessage(error).split('\n')[0].trim();
    const { server, database } = appConfig.db;
    return [
        `Database unreachable — this is an environment problem, not a test failure.`,
        `  ${label} at ${server || '<DB_SERVER unset>'}, database ${database || '<DB_NAME unset>'}: ${firstLine}`,
        ...errors.explain(error),
        "  Every DB-backed test fails while this persists, so this run's results are not meaningful.",
    ].join('\n');
}

/**
 * Database connection — the only thing in the harness that talks to a database.
 *
 * The engine comes from `DB_ENGINE`: `mssql` (SQL Server, the default) or `postgres`. The public
 * methods below (`executeQuery`, `executeUpdate`, `executePreparedStatement`, `close`) are what the
 * rest of the harness and the AI agents depend on, whichever engine is underneath — keep their
 * signatures stable.
 *
 * Parameters are written `@name` for every engine. The SQL itself is still the engine's dialect —
 * `TOP 5` on SQL Server, `LIMIT 5` on PostgreSQL — so the queries in `data/sql_queries.ts` are written
 * for the project's engine.
 */
class DbConnection {
    private adapter: DbAdapter | null = null;

    private async getAdapter(): Promise<DbAdapter> {
        // Already refused for a reason that will not clear by itself — don't wait for another
        // timeout to be told the same thing.
        if (blockingConnectionFailure) {
            throw new Error(blockingConnectionFailure);
        }

        // A misconfiguration is not worth a connect timeout to discover.
        assertDbConfigured();

        if (!this.adapter) {
            const engine = ENGINES[appConfig.db.engine];
            try {
                this.adapter = await engine.connect(appConfig.db);
            } catch (error) {
                const explanation = explainConnectionFailure(error, engine.errors, engine.label);
                if (engine.errors.isPersistentRefusal(error)) {
                    // Logged once for the whole worker; later tests get the message without the noise.
                    blockingConnectionFailure = explanation;
                    console.error(`\n${explanation}\n`);
                }
                const wrapped = new Error(explanation);
                (wrapped as Error & { cause?: unknown }).cause = error;
                throw wrapped;
            }
        }
        return this.adapter;
    }

    /**
     * True when dumping this error again would only add noise: either it is a configuration
     * problem whose message already says everything actionable, or it is a connection refusal
     * that was explained once already. Re-printing the driver stack per query buries the one
     * sentence that matters.
     */
    private static isAlreadyReported(error: unknown): boolean {
        const message = errorMessage(error);
        if (message.startsWith(CONFIG_ERROR_PREFIX) || message.startsWith('Database unreachable')) {
            return true;
        }
        return blockingConnectionFailure !== null && message === blockingConnectionFailure;
    }

    private async run(kind: string, query: string, params?: Record<string, unknown>): Promise<QueryResult> {
        try {
            const adapter = await this.getAdapter();
            return await adapter.query(query, params);
        } catch (error) {
            if (!DbConnection.isAlreadyReported(error)) {
                console.error(`Database ${kind} error:`, error);
            }
            throw error;
        }
    }

    /** Run a query and return its rows. */
    async executeQuery(query: string): Promise<QueryResult> {
        return this.run('query', query);
    }

    /** Run an INSERT, UPDATE or DELETE and return how many rows it changed. */
    async executeUpdate(query: string): Promise<number> {
        return (await this.run('update', query)).rowCount;
    }

    /**
     * Run a query with named parameters, written `@name` in the SQL whatever the engine.
     * Use this for anything derived from test input — see `data/sql_queries.ts`.
     */
    async executePreparedStatement(query: string, params: Record<string, unknown>): Promise<QueryResult> {
        return this.run('prepared statement', query, params);
    }

    /** Close the connection. Safe to call when none was opened. */
    async close(): Promise<void> {
        if (this.adapter) {
            const adapter = this.adapter;
            this.adapter = null;
            await adapter.close();
        }
    }
}

export default DbConnection;

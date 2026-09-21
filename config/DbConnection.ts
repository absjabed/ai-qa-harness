import * as sql from 'mssql';
import { appConfig } from './testConfig';

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
 * Without this, an unset DB_SERVER reaches `mssql` as an empty host and comes back as
 * "Failed to connect to :1433" under a wall of driver frames — which reads like an outage rather
 * than a missing `.env`, and sends people looking at the network instead of their own config.
 */
function assertDbConfigured(): void {
    const missing = (
        [
            ['DB_SERVER', appConfig.db.server],
            ['DB_NAME', appConfig.db.database],
            ['DB_USER', appConfig.db.authentication.options.userName],
            ['DB_PASSWORD', appConfig.db.authentication.options.password],
        ] as const
    )
        .filter(([, value]) => !value)
        .map(([name]) => name);

    if (missing.length > 0) {
        throw new Error(
            `${CONFIG_ERROR_PREFIX}: ${missing.join(', ')} not set in .env.\n` +
            '  Copy .env.example to .env and fill in the DB_* block — see SETUP.md step 3.\n' +
            '  If this project has no database, set DB_VALIDATION_ENABLED=false and remove the\n' +
            '  DB-backed assertions from your page objects.'
        );
    }
}

/** Refusals that persist until a human changes something, as opposed to transient network faults. */
function isPersistentRefusal(error: unknown): boolean {
    const message = String((error as { message?: string })?.message ?? '');
    return /not allowed to access the server|Cannot open server|Login failed for user/i.test(message);
}

/**
 * Turn the driver's error into something that says what is wrong and what to do about it. The raw
 * error is a wall of driver stack frames in which the one useful sentence is easy to miss.
 */
function explainConnectionFailure(error: unknown): string {
    const raw = String((error as { message?: string })?.message ?? error);
    const firstLine = raw.split('\n')[0].trim();
    const blockedIp = raw.match(/IP address '([^']+)'/)?.[1];

    const lines = [
        'Database unreachable — this is an environment problem, not a test failure.',
        `  ${firstLine}`,
    ];

    if (blockedIp) {
        lines.push(
            `  The database firewall on '${appConfig.db.server}' is refusing this machine's IP (${blockedIp}).`,
            "  Add this IP to the server's firewall allow-list. On Azure SQL that is",
            '  Portal -> SQL server -> Networking -> Firewall rules, or against the master database:',
            `    EXEC sp_set_firewall_rule N'AllowTestClient', '${blockedIp}', '${blockedIp}';`,
            '  A new rule can take a few minutes to take effect.',
            '  A dynamic IP will keep causing this — consider allowing the range rather than one address.'
        );
    } else if (/Login failed for user/i.test(raw)) {
        lines.push(
            '  Credentials were rejected. Check DB_USER / DB_PASSWORD in .env against the environment',
            `  you are pointing at (DB_SERVER=${appConfig.db.server || '<unset>'}, DB_NAME=${appConfig.db.database || '<unset>'}).`
        );
    }

    lines.push("  Every DB-backed test fails while this persists, so this run's results are not meaningful.");
    return lines.join('\n');
}

/**
 * Database connection utility — SQL Server via the `mssql` package.
 *
 * Projects on a different engine should swap the driver here and reshape `appConfig.db` in
 * `config/testConfig.ts` to match. The public method surface below (`executeQuery`,
 * `executeUpdate`, `executePreparedStatement`, `close`) is what the rest of the harness and the AI
 * agents depend on, so keep those signatures stable.
 */
class DbConnection {
    private pool: sql.ConnectionPool | null = null;
    private config: sql.config;

    constructor() {
        this.config = appConfig.db as sql.config;
    }

    /**
     * Get database connection pool
     * @returns {Promise<sql.ConnectionPool>} Connection pool
     */
    async getConnection(): Promise<sql.ConnectionPool> {
        // Already refused for a reason that will not clear by itself — don't wait for another
        // timeout to be told the same thing.
        if (blockingConnectionFailure) {
            throw new Error(blockingConnectionFailure);
        }

        // A misconfiguration is not worth a connect timeout to discover.
        assertDbConfigured();

        if (!this.pool) {
            try {
                this.pool = await new sql.ConnectionPool(this.config).connect();
            } catch (error) {
                const explanation = explainConnectionFailure(error);
                if (isPersistentRefusal(error)) {
                    // Logged once for the whole worker; later tests get the message without the noise.
                    blockingConnectionFailure = explanation;
                    console.error(`\n${explanation}\n`);
                }
                const wrapped = new Error(explanation);
                (wrapped as Error & { cause?: unknown }).cause = error;
                throw wrapped;
            }
        }
        return this.pool;
    }

    /**
     * True when dumping this error again would only add noise: either it is a configuration
     * problem whose message already says everything actionable, or it is a connection refusal
     * that was explained once already. Re-printing the driver stack per query buries the one
     * sentence that matters.
     */
    private static isAlreadyReported(error: unknown): boolean {
        const message = String((error as { message?: string })?.message ?? '');
        if (message.startsWith(CONFIG_ERROR_PREFIX)) {
            return true;
        }
        return blockingConnectionFailure !== null && message === blockingConnectionFailure;
    }

    /**
     * Execute a SQL query
     * @param {string} query - SQL query to execute
     * @returns {Promise<sql.IResult>} Query result
     */
    async executeQuery(query: string): Promise<sql.IResult<any>> {
        try {
            const pool = await this.getConnection();
            const result = await pool.request().query(query);
            return result;
        } catch (error) {
            // A connection refusal has already been explained once — re-printing the whole
            // driver stack for every subsequent test buries the real message.
            if (!DbConnection.isAlreadyReported(error)) {
                console.error('Database query error:', error);
            }
            throw error;
        }
    }

    /**
     * Execute a SQL update/insert/delete statement
     * @param {string} query - SQL statement to execute
     * @returns {Promise<number>} Number of rows affected
     */
    async executeUpdate(query: string): Promise<number> {
        try {
            const pool = await this.getConnection();
            const result = await pool.request().query(query);
            return result.rowsAffected[0];
        } catch (error) {
            if (!DbConnection.isAlreadyReported(error)) {
                console.error('Database update error:', error);
            }
            throw error;
        }
    }

    /**
     * Execute a prepared statement with parameters
     * @param {string} query - SQL query with parameters
     * @param {Object} params - Parameters object {name: value}
     * @returns {Promise<sql.IResult>} Query result
     */
    async executePreparedStatement(query: string, params: Record<string, any>): Promise<sql.IResult<any>> {
        try {
            const pool = await this.getConnection();
            const request = pool.request();

            for (const [key, value] of Object.entries(params)) {
                request.input(key, value);
            }

            const result = await request.query(query);
            return result;
        } catch (error) {
            if (!DbConnection.isAlreadyReported(error)) {
                console.error('Database prepared statement error:', error);
            }
            throw error;
        }
    }

    /**
     * Close database connection
     */
    async close(): Promise<void> {
        if (this.pool) {
            await this.pool.close();
            this.pool = null;
        }
    }
}

export default DbConnection;

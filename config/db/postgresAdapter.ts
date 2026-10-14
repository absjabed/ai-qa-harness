import type * as Pg from 'pg';
import type { DbSettings } from '../testConfig';
import { errorMessage, type DbAdapter, type EngineErrors } from './types';

/**
 * PostgreSQL, through the `pg` package.
 *
 * The driver is loaded when a connection is opened rather than at import, so a project on another
 * engine can `npm uninstall pg @types/pg` — delete this file and its entry in
 * `config/DbConnection.ts` at the same time, or the typecheck will point at them.
 */
export async function connectPostgres(settings: DbSettings): Promise<DbAdapter> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pg: typeof Pg = require('pg');

    const pool = new pg.Pool({
        host: settings.server,
        port: settings.port,
        database: settings.database,
        user: settings.user,
        password: settings.password,
        ssl: settings.encrypt ? { rejectUnauthorized: !settings.trustServerCertificate } : false,
        connectionTimeoutMillis: 30_000,
        max: 2,
    });

    // `pg` connects lazily. Prove the connection now, so a refusal surfaces here — where DbConnection
    // explains it and latches a persistent one — rather than inside whichever query happens to run first.
    try {
        const client = await pool.connect();
        client.release();
    } catch (error) {
        await pool.end().catch(() => undefined);
        throw error;
    }

    return {
        async query(text, params = {}) {
            const { sql, values } = toPositional(text, params);
            const result = await pool.query(sql, values);
            const rows = result.rows ?? [];
            return { rows, recordset: rows, rowCount: result.rowCount ?? rows.length };
        },
        close: () => pool.end(),
    };
}

/**
 * `@name` → `$1`, `$2`, … in order of first appearance.
 *
 * The harness writes named parameters the same way for every engine, so a key in
 * `data/sql_queries.ts` keeps its shape if a project changes engine. Only names present in `params` are
 * replaced, so an `@` elsewhere — inside a string literal, say — is left alone unless the word after it
 * happens to be a parameter name.
 */
export function toPositional(text: string, params: Record<string, unknown>): { sql: string; values: unknown[] } {
    const order: string[] = [];
    const sql = text.replace(/@(\w+)/g, (match, name: string) => {
        if (!Object.prototype.hasOwnProperty.call(params, name)) return match;
        let index = order.indexOf(name);
        if (index < 0) {
            order.push(name);
            index = order.length - 1;
        }
        return `$${index + 1}`;
    });
    return { sql, values: order.map((name) => params[name]) };
}

/** SQLSTATE codes for refusals that persist until someone changes the server or `.env`. */
const PERSISTENT_CODES = new Set([
    '28P01', // invalid password
    '28000', // invalid authorization — includes "no pg_hba.conf entry"
    '3D000', // database does not exist
]);

export const postgresErrors: EngineErrors = {
    isPersistentRefusal(error) {
        const code = (error as { code?: string })?.code;
        return (
            (code !== undefined && PERSISTENT_CODES.has(code)) ||
            /does not support SSL connections|no pg_hba\.conf entry/i.test(errorMessage(error))
        );
    },

    explain(error) {
        const raw = errorMessage(error);
        const code = (error as { code?: string })?.code;
        const blockedHost = raw.match(/no pg_hba\.conf entry for host "([^"]+)"/)?.[1];

        if (blockedHost) {
            return [
                `  The server is refusing connections from this machine (${blockedHost}).`,
                '  Allow it in the server\'s pg_hba.conf — or, on a managed server, its firewall:',
                '  Azure Database for PostgreSQL -> Networking; AWS RDS -> the instance\'s security group.',
                '  A dynamic IP will keep causing this — consider allowing the range rather than one address.',
            ];
        }
        if (code === '28P01') {
            return ['  Credentials were rejected. Check DB_USER and DB_PASSWORD in .env against this server.'];
        }
        if (code === '3D000') {
            return ['  The server has no database by that name. Check DB_NAME.'];
        }
        if (/does not support SSL connections/i.test(raw)) {
            return ['  This server does not accept TLS. For a local server, set DB_ENCRYPT=false in .env.'];
        }
        if (/self[- ]signed|unable to verify|certificate/i.test(raw)) {
            return [
                '  TLS certificate problem. For a QA server with a self-signed certificate, set',
                '  DB_TRUST_SERVER_CERTIFICATE=true in .env — or point NODE_EXTRA_CA_CERTS at its CA.',
            ];
        }
        if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout/i.test(raw)) {
            return ['  Nothing answered. Check DB_SERVER and DB_PORT, and that this machine can reach the server.'];
        }
        return [];
    },
};

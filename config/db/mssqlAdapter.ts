import type * as Mssql from 'mssql';
import type { DbSettings } from '../testConfig';
import { errorMessage, type DbAdapter, type EngineErrors } from './types';

/**
 * SQL Server, through the `mssql` package.
 *
 * The driver is loaded when a connection is opened rather than at import, so a project on another
 * engine can `npm uninstall mssql @types/mssql` — delete this file and its entry in
 * `config/DbConnection.ts` at the same time, or the typecheck will point at them.
 */
export async function connectMssql(settings: DbSettings): Promise<DbAdapter> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sql: typeof Mssql = require('mssql');

    const pool = await new sql.ConnectionPool({
        server: settings.server,
        port: settings.port,
        database: settings.database,
        user: settings.user,
        password: settings.password,
        options: {
            encrypt: settings.encrypt,
            trustServerCertificate: settings.trustServerCertificate,
        },
    }).connect();

    return {
        async query(text, params = {}) {
            const request = pool.request();
            for (const [name, value] of Object.entries(params)) {
                request.input(name, value as never);
            }
            const result = await request.query(text);
            const rows = result.recordset ?? [];
            return { rows, recordset: rows, rowCount: result.rowsAffected?.[0] ?? rows.length };
        },
        close: () => pool.close(),
    };
}

export const mssqlErrors: EngineErrors = {
    isPersistentRefusal(error) {
        return /not allowed to access the server|Cannot open server|Login failed for user|Cannot open database/i.test(
            errorMessage(error)
        );
    },

    explain(error) {
        const raw = errorMessage(error);
        const blockedIp = raw.match(/IP address '([^']+)'/)?.[1];

        if (blockedIp) {
            return [
                `  The server's firewall is refusing this machine's IP (${blockedIp}).`,
                "  Add this IP to the server's firewall allow-list. On Azure SQL that is",
                '  Portal -> SQL server -> Networking -> Firewall rules, or against the master database:',
                `    EXEC sp_set_firewall_rule N'AllowTestClient', '${blockedIp}', '${blockedIp}';`,
                '  A new rule can take a few minutes to take effect.',
                '  A dynamic IP will keep causing this — consider allowing the range rather than one address.',
            ];
        }
        if (/Login failed for user/i.test(raw)) {
            return ['  Credentials were rejected. Check DB_USER and DB_PASSWORD in .env against this server.'];
        }
        if (/Cannot open database/i.test(raw)) {
            return ['  The login worked but the database was not found or not permitted. Check DB_NAME.'];
        }
        if (/self[- ]signed|certificate/i.test(raw)) {
            return [
                '  TLS certificate problem. For a QA server with a self-signed certificate, set',
                '  DB_TRUST_SERVER_CERTIFICATE=true in .env.',
            ];
        }
        return [];
    },
};

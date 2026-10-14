import { projectProfile } from './projectProfile';
import type { DbEngine } from './db/types';

/**
 * Consolidated test configuration.
 *
 * Every value here comes from the environment (`.env`, see `.env.example`). Nothing in this file
 * carries a real URL, credential, or hostname — that is invariant I6, and it is what lets the same
 * harness point at QA, UAT, or a local stack without a code change.
 */

/** Throw rather than run against a placeholder, so a misconfigured run fails at setup, not mid-suite. */
function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(
            `Required environment variable ${name} is not set.\n` +
            `  Copy .env.example to .env and fill it in — see PROJECT-PROFILE.md section 11.`
        );
    }
    return value;
}

/** Optional value with a default; used where an unset variable has a sane fallback. */
function optional(name: string, fallback = ''): string {
    return process.env[name] || fallback;
}

/** `mssql` (SQL Server) unless `.env` says otherwise. Validated when a connection is first opened. */
const dbEngine = optional('DB_ENGINE', 'mssql').toLowerCase() as DbEngine;

/** Engine-neutral database settings. Each adapter in `config/db/` maps these onto its own driver. */
export interface DbSettings {
    engine: DbEngine;
    server: string;
    port: number;
    database: string;
    user: string;
    password: string;
    /** Encrypt the connection. On by default; turn off only for a local server without TLS. */
    encrypt: boolean;
    /**
     * Accept the server's certificate without verifying it. On by default, because QA servers commonly
     * run self-signed certificates; turn it off where the certificate is real and should be checked.
     */
    trustServerCertificate: boolean;
}

export const appConfig = {
    appName: projectProfile.appName,

    /** Base URL of the application under test. Required — there is no safe default. */
    get baseUrl(): string {
        return required('BASE_URL');
    },

    /** Path the baseline role lands on after a successful login. */
    landingPath: optional('LANDING_PATH', '/'),

    browser: optional('BROWSER', 'chromium'),
    headless: process.env.HEADLESS === 'true',

    /** Database connection settings — `DB_ENGINE` picks SQL Server or PostgreSQL. See `config/DbConnection.ts`. */
    db: {
        engine: dbEngine,
        server: optional('DB_SERVER'),
        port: parseInt(optional('DB_PORT', dbEngine === 'postgres' ? '5432' : '1433'), 10),
        database: optional('DB_NAME'),
        user: optional('DB_USER'),
        password: optional('DB_PASSWORD'),
        encrypt: optional('DB_ENCRYPT', 'true') !== 'false',
        trustServerCertificate: optional('DB_TRUST_SERVER_CERTIFICATE', 'true') !== 'false',
    } as DbSettings,

    /** Cheap read-only query used by `npm run db:check` to prove connectivity. */
    dbSmokeQuery: optional('DB_SMOKE_QUERY', 'SELECT 1 AS ok'),

    /** API under test. Only meaningful when `API_TESTS_ENABLED=true`. */
    api: {
        get baseUrl(): string {
            return required('API_BASE_URL');
        },
        username: optional('API_USERNAME'),
        password: optional('API_PASSWORD'),
    },
};

export default appConfig;

import { projectProfile } from './projectProfile';

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
            `  Copy .env.example to .env and fill it in — see PROJECT-PROFILE.md section 10.`
        );
    }
    return value;
}

/** Optional value with a default; used where an unset variable has a sane fallback. */
function optional(name: string, fallback = ''): string {
    return process.env[name] || fallback;
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

    /**
     * Database configuration. Shaped for `mssql`; if the project uses a different engine, change
     * this shape and `config/DbConnection.ts` together.
     */
    db: {
        server: optional('DB_SERVER'),
        port: parseInt(optional('DB_PORT', '1433'), 10),
        database: optional('DB_NAME'),
        authentication: {
            type: 'default',
            options: {
                userName: optional('DB_USER'),
                password: optional('DB_PASSWORD'),
            },
        },
        options: {
            encrypt: true,
            trustServerCertificate: true,
        },
    },

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

export function getDbConfig(): any {
    return appConfig.db;
}

export default appConfig;

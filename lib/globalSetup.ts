import { FullConfig } from '@playwright/test';
import { appConfig } from '../config/testConfig';
import { projectProfile } from '../config/projectProfile';
import DbConnection from '../config/DbConnection';
import { resetTestData, seedTestData } from '../data/seed';

/**
 * Runs once before every test run — the automatic half of the entry criteria in PROJECT-PROFILE.md
 * section 10.
 *
 * A run against an environment that is down produces a report where every test failed, for one reason,
 * that looks like a mass regression. Checking readiness first turns that into one clear message and no
 * misleading report. It also gives test data a single, predictable place to be put into a known state.
 *
 * Escape hatch: `SKIP_READINESS_CHECK=true` — for an API-only run where BASE_URL does not apply, or when
 * you knowingly want to run against an environment that fails the check.
 */
export default async function globalSetup(_config: FullConfig): Promise<void> {
    if (process.env.SKIP_READINESS_CHECK === 'true') {
        console.log('Readiness check skipped (SKIP_READINESS_CHECK=true).');
    } else {
        await checkApplicationReachable();
        if (projectProfile.dbValidationEnabled) await checkDatabaseReachable();
    }

    if (process.env.SEED_TEST_DATA === 'true') {
        console.log('Putting test data into a known state...');
        await resetTestData();
        await seedTestData();
        console.log('Test data seeded.');
    }
}

async function checkApplicationReachable(): Promise<void> {
    const url = appConfig.baseUrl; // throws a clear message if BASE_URL is unset
    let status: number;
    try {
        // Any HTTP answer — even 401 or a redirect to a login page — proves the application is up.
        const response = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(15_000) });
        status = response.status;
    } catch (error) {
        const reason = (error as { cause?: { message?: string }; message?: string }).cause?.message ?? (error as Error).message;
        throw new Error(
            `Entry criteria not met: the application is not reachable at ${url}\n` +
            `  ${reason}\n` +
            '  Check the environment is up, BASE_URL in .env is right, and this machine can reach it.\n' +
            '  If this is a certificate error from an internal CA, point NODE_EXTRA_CA_CERTS at the CA\n' +
            '  certificate rather than disabling TLS verification.'
        );
    }
    if (status >= 500) {
        throw new Error(
            `Entry criteria not met: ${url} answered HTTP ${status}.\n` +
            '  The application is up but failing. Running the suite now would record every test as failed for\n' +
            '  a reason that has nothing to do with the tests.'
        );
    }
    console.log(`Application reachable: ${url} (HTTP ${status})`);
}

async function checkDatabaseReachable(): Promise<void> {
    const db = new DbConnection();
    try {
        await db.executeQuery(appConfig.dbSmokeQuery);
        console.log('Database reachable.');
    } catch (error) {
        throw new Error(
            `Entry criteria not met: the database is not reachable.\n${(error as Error).message}\n` +
            '  If this project has no database, set DB_VALIDATION_ENABLED=false in .env.'
        );
    } finally {
        await db.close();
    }
}

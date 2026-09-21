import 'dotenv/config';
import DbConnection from './DbConnection';
import { appConfig } from './testConfig';
import { projectProfile } from './projectProfile';

/**
 * Connectivity smoke check — `npm run db:check`.
 *
 * Runs the project's own `DB_SMOKE_QUERY` rather than a query against a specific table, so this
 * file never needs editing when the harness moves to a new project. Exits non-zero on failure so
 * CI can gate on it.
 */
async function testConnection(): Promise<void> {
    if (!projectProfile.dbValidationEnabled) {
        console.log('DB validation is disabled for this project (DB_VALIDATION_ENABLED=false) — nothing to check.');
        return;
    }

    const db = new DbConnection();
    console.log(`Connecting to ${appConfig.db.database || '<DB_NAME unset>'} on ${appConfig.db.server || '<DB_SERVER unset>'}...`);

    try {
        const result = await db.executeQuery(appConfig.dbSmokeQuery);
        console.log('Connected. Smoke query returned:');
        console.table(result.recordset);
    } catch (error) {
        // Message only. Every failure this check produces — unset config, blocked IP, rejected
        // credentials — is explained in the message itself, and the driver stack behind it points
        // at connection internals rather than at anything the reader can act on.
        console.error('Database smoke check failed.\n');
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    } finally {
        await db.close();
    }
}

testConnection();

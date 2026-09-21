import { projectProfile } from '@config/projectProfile';

/**
 * Centralized SQL — invariant I3.
 *
 * Every DB-backed assertion names a key from this file. No spec file writes SQL inline, and no
 * page object builds a query string of its own. A schema change then has exactly one place to be
 * fixed, and a reviewer can see the whole database surface the suite depends on in one read.
 *
 * Conventions, followed by the AI agents when they add a key:
 * - Name the key for what it answers, not how: `getOpenRecordsForOwner`, not `selectFromRecords`.
 * - A query with no parameters is a string; a parameterized one is a function returning a string.
 * - Parameterize through `executePreparedStatement` for anything derived from test input. String
 *   interpolation is acceptable only for values the test itself controls, never for values that
 *   came from the page.
 * - Keep queries read-only unless the key name says otherwise (`unlock...`, `reset...`).
 * - The AI agents do not invent SQL — they have no schema visibility. When a plan needs a query
 *   that is not here, the agent asks for the query text and adds it under these conventions.
 */

const schema = projectProfile.schemaPrefix;

export const sqlQueries = {
    /**
     * Connectivity probe. Kept trivial on purpose — `npm run db:check` uses DB_SMOKE_QUERY from
     * .env, this is the in-code fallback.
     */
    healthCheck: 'SELECT 1 AS ok',

    /**
     * Example of a parameterless query. Replace with a real one for this project.
     *
     * @example
     * const result = await db.executeQuery(sqlQueries.getAllGroups);
     */
    getAllGroups: `
        SELECT Name
        FROM ${schema}.CHANGE_ME_Groups
        ORDER BY Name
    `,

    /**
     * Example of a parameterized query. Replace with a real one for this project.
     *
     * @example
     * const result = await db.executeQuery(sqlQueries.getRecordByIdentifier(recordData.validIdentifier));
     */
    getRecordByIdentifier: (identifier: string): string => `
        SELECT Id, Identifier, Status
        FROM ${schema}.CHANGE_ME_Records
        WHERE Identifier = '${identifier}'
    `,

    /**
     * Example of a write used to put the environment back into a testable state — an account
     * locked out by a deliberate bad-credentials test, for instance. Keep writes rare, narrowly
     * scoped, and obvious from the key name.
     */
    unlockUserAccount: (userId: number): string => `
        UPDATE ${schema}.CHANGE_ME_Users
        SET LockoutEndDateUtc = NULL
        WHERE Id = ${userId}
    `,
};

export default sqlQueries;

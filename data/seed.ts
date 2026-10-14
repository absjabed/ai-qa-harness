/**
 * Test data provisioning — put the environment into a known state before a run.
 *
 * Runs from `lib/globalSetup.ts` when `SEED_TEST_DATA=true`: `resetTestData()` first, then
 * `seedTestData()`. Both ship empty, because what "known state" means is entirely your application's.
 *
 * Why it matters: tests that depend on whatever data happens to be in the environment cannot run in
 * parallel, drift as other people use the environment, and fail for reasons the healer can only diagnose
 * as "stale data". A reset-then-seed step removes that whole class of failure.
 *
 * Conventions:
 * - Statements live in `data/sql_queries.ts` like every other query (I3), with keys named for what they
 *   do: `seed…` to create, `reset…` to remove. Never inline SQL here.
 * - Make both idempotent. Running the pair twice must leave the same state as running it once.
 * - Seed only what tests need, identified by values in `data/testData.ts` — so a test and its seed data
 *   refer to the same key, and changing one changes both.
 * - `context/<area>.md` recipes are the natural source: their "Recipes" sections describe exactly how to
 *   put an area into a given state.
 * - No database the suite can reach? Reset through the application instead — a reset endpoint, an admin
 *   API — from these same functions. Nothing else depends on them talking to a database.
 * - Tests that share records need a reset before each test, not just each run: call `resetTestData()` from
 *   a `test.beforeEach` in that spec (docs/WORKFLOWS.md workflow 10).
 * - This runs with the suite's own credentials from `.env`, never the agents' read-only MCP account — it
 *   writes, and the agents must not.
 */

import DbConnection from '../config/DbConnection';
// import { sqlQueries } from './sql_queries';

/** Remove anything a previous run left behind. */
export async function resetTestData(): Promise<void> {
    const db = new DbConnection();
    try {
        // CHANGE_ME — e.g.
        // await db.executeUpdate(sqlQueries.resetTestRecords);
    } finally {
        await db.close();
    }
}

/** Create the data the suite expects to find. */
export async function seedTestData(): Promise<void> {
    const db = new DbConnection();
    try {
        // CHANGE_ME — e.g.
        // await db.executeUpdate(sqlQueries.seedValidRecord(recordData.validIdentifier));
    } finally {
        await db.close();
    }
}

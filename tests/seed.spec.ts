import { test } from '@playwright/test';

/**
 * Seed file for the `playwright-test-generator` agent.
 *
 * The agent's live browser drive starts from a seed spec — it opens this file's context to reach
 * the application before exploring a scenario. Leave the body empty; the agent writes generated
 * tests to their own files, never here.
 *
 * If a scenario needs an authenticated starting point, point the agent at a seed that logs in
 * rather than adding login steps to this one.
 */
test.describe('Seed', () => {
    test('seed', async ({ page }) => {
        // Generated code lands in its own spec file — this body stays empty.
    });
});

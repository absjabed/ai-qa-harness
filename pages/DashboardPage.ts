import { expect, Page, Locator } from '@playwright/test';
import BasePage from './BasePage';
import DbConnection from '@config/DbConnection';
import { sqlQueries } from '@data/sql_queries';

/**
 * DashboardPage — the landing screen after login.
 *
 * Ships as a template for two reasons: `userLogin` needs somewhere to confirm the session actually
 * started, and this is the smallest complete example of the conventions the rest of `pages/`
 * follows — including a DB-backed assertion, which is the pattern the agents copy when a scenario
 * needs to verify substance rather than the UI's own report of itself.
 */
export default class DashboardPage extends BasePage {
    readonly heading: Locator;
    /** An element only a signed-in user sees — the account menu, a Sign out button, the user's name. */
    readonly signedInMarker: Locator;
    readonly groupTiles: Locator;

    constructor(page: Page) {
        super(page);

        // CHANGE_ME — replace with this application's real selectors.
        this.heading = page.getByRole('heading', { level: 1 });
        // Never a generic heading: the login screen has headings too, and a failed login would pass.
        this.signedInMarker = page.getByRole('button', { name: 'CHANGE_ME_Account' });
        this.groupTiles = page.getByTestId('CHANGE_ME_group-tile');
    }

    /** True once the dashboard has rendered. Returns rather than throws so callers can branch. */
    async isLoaded(): Promise<boolean> {
        try {
            await this.waitForVisible(this.signedInMarker);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Confirm a login actually established a session.
     *
     * Called by the shared `userLogin` helper, so every authenticated test gets this check for
     * free. Asserting on a landing element rather than just the URL matters: many applications
     * redirect to the dashboard route and then render an error, which a URL check would pass. And the
     * element must be one only a signed-in user sees: a page heading is on the login screen too, so a
     * failed login would pass a heading check.
     */
    async expectLoggedIn(): Promise<void> {
        await expect(
            this.signedInMarker,
            'Not signed in: the element only a signed-in user sees (DashboardPage.signedInMarker) did not appear. ' +
                'Either the login failed, or signedInMarker still needs pointing at the real application.'
        ).toBeVisible({ timeout: 15_000 });
    }

    /**
     * Example DB-backed assertion — the UI's tile list must match what the database holds.
     *
     * This is the shape invariant I3 requires: the query comes from `data/sql_queries.ts`, runs
     * through `config/DbConnection.ts`, and the comparison lives in the page object. A spec file
     * never opens a connection or writes SQL itself.
     */
    async expectGroupsMatchDatabase(): Promise<void> {
        const db = new DbConnection();
        try {
            const result = await db.executeQuery(sqlQueries.getAllGroups);
            const fromDb: string[] = result.rows.map((row) => row.Name);
            const fromUi = await this.groupTiles.allInnerTexts();
            await this.expectMatchesDatabase(fromUi.map((t) => t.trim()), fromDb);
        } finally {
            await db.close();
        }
    }
}

import { Page, Locator, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { appConfig } from '@config/testConfig';

/**
 * Shared behavior for every page object.
 *
 * Page objects extend this rather than repeating navigation, waiting, and table-reading helpers.
 * Anything here must be genuinely page-agnostic — the moment a helper needs to know about a
 * specific screen, it belongs on that screen's page object instead.
 */
export default abstract class BasePage {
    readonly page: Page;

    protected constructor(page: Page) {
        this.page = page;
    }

    /** Navigate to a path relative to `BASE_URL`. Pass '/' for the application root. */
    async goto(path = '/'): Promise<void> {
        const base = appConfig.baseUrl.replace(/\/$/, '');
        const suffix = path.startsWith('/') ? path : `/${path}`;
        await this.page.goto(`${base}${suffix}`, { waitUntil: 'domcontentloaded' });
    }

    /** Current URL, for assertions that care about where a flow landed. */
    url(): string {
        return this.page.url();
    }

    /**
     * Wait for a locator to be actionable.
     *
     * Prefer this over a fixed `waitForTimeout` — a sleep either wastes time or is too short on a
     * slow run, and it hides the real condition being waited on from whoever reads the test later.
     */
    async waitForVisible(locator: Locator, timeoutMs = 30_000): Promise<void> {
        await locator.waitFor({ state: 'visible', timeout: timeoutMs });
    }

    /**
     * Read a column out of a results table as plain strings.
     *
     * Used for set-membership and before/after comparisons, which is how invariant I5 says to
     * assert list contents — a count or a literal row value copied from a manual run breaks the
     * moment the environment is reseeded.
     */
    async readColumn(rowLocator: Locator, cellSelector: string): Promise<string[]> {
        const rows = await rowLocator.all();
        const values: string[] = [];
        for (const row of rows) {
            const text = await row.locator(cellSelector).innerText();
            values.push(text.trim());
        }
        return values;
    }

    /**
     * Assert that the UI's values match what the database returned, ignoring order.
     *
     * The common shape of a DB-backed assertion: the query is the source of truth, the page is
     * what is under test. Order is deliberately not compared — if ordering is the thing under
     * test, assert it explicitly rather than relying on this.
     */
    async expectMatchesDatabase(uiValues: string[], dbValues: string[]): Promise<void> {
        expect(new Set(uiValues)).toEqual(new Set(dbValues));
    }

    /**
     * Scope a locator that could match more than one element down to a single match — invariant
     * I7. An ambiguous locator that happened to work during exploration is the usual source of a
     * test that goes flaky weeks later.
     */
    firstOf(locator: Locator): Locator {
        return locator.first();
    }

    /**
     * Assert the current page has no accessibility violations at the given WCAG levels.
     *
     * Automated checks find roughly a third of accessibility problems — missing labels, contrast, landmark
     * and ARIA misuse — and none of the ones that need a person, such as whether focus order makes sense.
     * Treat a pass as "no obvious barriers", not "accessible". Tag tests that call this `@A11y`.
     *
     * Scope it with `include` to the region a story changed, so a pre-existing violation elsewhere on the
     * page does not fail an unrelated test; `exclude` for third-party widgets you cannot fix.
     */
    async expectNoAccessibilityViolations(options: { include?: string; exclude?: string[]; tags?: string[] } = {}): Promise<void> {
        let builder = new AxeBuilder({ page: this.page }).withTags(options.tags ?? ['wcag2a', 'wcag2aa']);
        if (options.include) builder = builder.include(options.include);
        for (const selector of options.exclude ?? []) builder = builder.exclude(selector);

        const { violations } = await builder.analyze();
        const summary = violations
            .map((v) => `  ${v.id} [${v.impact}] ${v.help} — ${v.nodes.length} element(s)\n    ${v.helpUrl}`)
            .join('\n');
        expect(violations, `Accessibility violations:\n${summary}`).toEqual([]);
    }
}

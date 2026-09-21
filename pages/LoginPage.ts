import { expect, Page, Locator } from '@playwright/test';
import BasePage from './BasePage';

/**
 * LoginPage — the one page object every project needs, so it ships wired up.
 *
 * Point the four locators below at the real application and this works as-is. Everything else in
 * `pages/` you write yourself (or let the `playwright-test-generator` agent write, which will
 * follow this file's shape).
 *
 * Locator convention, enforced by invariants I1 and I7: declare each locator as a `readonly`
 * property, initialize it once in the constructor, reference it as `this.<name>` in methods. Never
 * build a `page.locator(...)` inline inside a method body — a locator defined at the point of use
 * is invisible to anyone auditing what this page depends on, and is where ambiguous selectors
 * creep in.
 */
export default class LoginPage extends BasePage {
    readonly usernameInput: Locator;
    readonly passwordInput: Locator;
    readonly submitButton: Locator;
    readonly errorMessage: Locator;

    constructor(page: Page) {
        super(page);

        // CHANGE_ME — replace with this application's real selectors.
        // Prefer role/label-based locators over XPath where the app gives you the choice: they
        // survive markup changes that a positional XPath does not.
        this.usernameInput = page.getByLabel('CHANGE_ME_Email');
        this.passwordInput = page.getByLabel('CHANGE_ME_Password');
        this.submitButton = page.getByRole('button', { name: 'CHANGE_ME_Log in' });
        this.errorMessage = page.getByRole('alert');
    }

    /** Open the application's login screen. */
    async open(): Promise<void> {
        await this.goto('/');
    }

    /**
     * Log in. Credentials always arrive from `data/auth_data.ts` (invariant I4) — this method
     * takes strings so it stays testable, but no caller should ever hand it a literal.
     */
    async login(username: string, password: string): Promise<void> {
        await this.open();
        await this.waitForVisible(this.usernameInput);
        await this.usernameInput.fill(username);
        await this.passwordInput.fill(password);
        await this.submitButton.click();
    }

    /** Assert the failed-login message is shown. */
    async expectLoginFailed(): Promise<void> {
        await expect(this.errorMessage).toBeVisible({ timeout: 10_000 });
    }

    /** Assert the login screen is showing — for logout and session-expiry checks. */
    async expectOnLoginPage(): Promise<void> {
        await expect(this.submitButton).toBeVisible({ timeout: 10_000 });
    }
}

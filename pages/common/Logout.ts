import { Page, Locator, expect } from '@playwright/test';
import BasePage from '../BasePage';

/**
 * Logout — shared widget page object.
 *
 * Lives in `pages/common/` because it belongs to the chrome rather than to any one screen. Widgets
 * reachable from every page (nav bar, search box, toast container) go here; screen-specific page
 * objects go in `pages/`.
 */
export default class Logout extends BasePage {
    readonly profileMenu: Locator;
    readonly signOutButton: Locator;

    constructor(page: Page) {
        super(page);

        // CHANGE_ME — replace with this application's real selectors.
        this.profileMenu = page.getByRole('button', { name: 'CHANGE_ME_Account' });
        this.signOutButton = page.getByRole('menuitem', { name: 'CHANGE_ME_Sign out' });
    }

    async openProfileMenu(): Promise<void> {
        await this.profileMenu.click();
    }

    async clickSignOut(): Promise<void> {
        await expect(this.signOutButton).toBeVisible({ timeout: 10_000 });
        await this.signOutButton.click();
    }

    /** Sign out. Opens the profile menu first only if the sign-out control is not already on screen. */
    async logout(): Promise<void> {
        if (!(await this.signOutButton.isVisible())) await this.openProfileMenu();
        await this.clickSignOut();
    }
}

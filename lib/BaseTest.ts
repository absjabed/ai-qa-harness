import { test as base, request as apiRequest, Page } from '@playwright/test';
import { appConfig } from '@config/testConfig';
import ApiClient from './api/ApiClient';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import Logout from '../pages/common/Logout';

/**
 * Page Factory — invariant I2.
 *
 * Every page object is reached through a named fixture declared here. Tests never call
 * `new SomePage(page)`: a fixture gives one construction site per page object, so a constructor
 * change is a one-line edit rather than a grep across the suite, and a test's dependencies are
 * visible in its own signature.
 *
 * Adding a page object is three edits in this file, in order:
 *   1. import it,
 *   2. add its field to `Fixtures`,
 *   3. add its factory to `test.extend`.
 *
 * Fixture naming: camelCase of the class (`RecordListPage` -> `recordListPage`). The
 * `playwright-test-generator` agent reads this file for the exact names in use, so a fixture that
 * does not follow the convention is one it will not find.
 */
/**
 * Per-test teardown. A test that creates data registers how to remove it, at the moment it creates it:
 *
 *     const id = await recordPage.create(recordData.newRecord);
 *     cleanup.add('delete created record', () => recordPage.delete(id));
 *
 * Tasks run after the test in reverse order, whether it passed or failed, so a failing test does not leave
 * data behind for the next one to trip over. A task that throws fails the test — leaked data is a real
 * problem, not noise to swallow.
 */
export interface Cleanup {
    add(label: string, task: () => Promise<void> | void): void;
}

type Fixtures = {
    cleanup: Cleanup;
    loginPage: LoginPage;
    dashboardPage: DashboardPage;
    logout: Logout;
    apiClient: ApiClient;

    // CHANGE_ME — add one entry per page object in `pages/`, e.g.:
    // recordListPage: RecordListPage;
};

export const test = base.extend<Fixtures>({
    cleanup: async ({}, use: (r: Cleanup) => Promise<void>) => {
        const tasks: { label: string; task: () => Promise<void> | void }[] = [];
        await use({ add: (label, task) => tasks.push({ label, task }) });

        const failures: string[] = [];
        for (const { label, task } of tasks.reverse()) {
            try {
                await task();
            } catch (error) {
                failures.push(`${label}: ${(error as Error).message}`);
            }
        }
        if (failures.length) {
            throw new Error(`Cleanup left data behind:\n  ${failures.join('\n  ')}`);
        }
    },

    loginPage: async ({ page }: { page: Page }, use: (r: LoginPage) => Promise<void>) => {
        await use(new LoginPage(page));
    },

    dashboardPage: async ({ page }: { page: Page }, use: (r: DashboardPage) => Promise<void>) => {
        await use(new DashboardPage(page));
    },

    logout: async ({ page }: { page: Page }, use: (r: Logout) => Promise<void>) => {
        await use(new Logout(page));
    },

    /**
     * API client with auth already attached. Only used by specs under `tests/api/`, which run in
     * their own Playwright project with no browser. Delete this fixture if the project has no API
     * surface — `appConfig.api.baseUrl` throws when `API_BASE_URL` is unset, which is the right
     * behavior for a project that does use the API and forgot to configure it.
     */
    apiClient: async ({}, use: (r: ApiClient) => Promise<void>) => {
        const context = await apiRequest.newContext({
            baseURL: appConfig.api.baseUrl,
            httpCredentials: {
                username: appConfig.api.username,
                password: appConfig.api.password,
                send: 'always',
            },
        });
        await use(new ApiClient(context));
        await context.dispose();
    },

    // CHANGE_ME — add one factory per page object, e.g.:
    // recordListPage: async ({ page }: { page: Page }, use: (r: RecordListPage) => Promise<void>) => {
    //     await use(new RecordListPage(page));
    // },
});

export { expect } from '@playwright/test';
export default test;

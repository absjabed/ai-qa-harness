import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * Playwright configuration.
 *
 * Nothing here names a specific application — `BASE_URL` and the rest come from `.env`
 * (see `.env.example`). The `api` project is separated from the browser projects so API specs run
 * without launching a browser; delete it if the project has no API surface.
 */

/** Headed by default: this suite is normally watched while it runs. Set HEADLESS=true in CI. */
const headless = process.env.HEADLESS === 'true';

export default defineConfig({
    testDir: './tests',

    /* Maximum time one test can run for */
    timeout: 180 * 1000,

    /* Tests share application state and test data, so they run in sequence by default. Turn this
       on once the suite's data is isolated per test — not before, or failures become unreadable. */
    fullyParallel: false,

    /* Fail the build on CI if you accidentally left test.only in the source code */
    forbidOnly: !!process.env.CI,

    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,

    workers: 1,

    reporter: [
        ['html', { outputFolder: 'playwright-report' }],
        ['list'],
        ['json', { outputFile: 'test-results/results.json' }],
    ],

    use: {
        baseURL: process.env.BASE_URL,

        /* Collect trace when retrying the failed test */
        trace: 'on-first-retry',

        screenshot: 'only-on-failure',
        video: 'retain-on-failure',

        actionTimeout: 30 * 1000,
        navigationTimeout: 60 * 1000,
    },

    projects: [
        {
            name: 'chromium',
            testIgnore: /api[\\/]/,
            use: {
                browserName: 'chromium',
                viewport: null, // real maximized window
                launchOptions: {
                    headless,
                    args: ['--start-maximized'],
                },
            },
        },
        {
            name: 'edge',
            testIgnore: /api[\\/]/,
            use: {
                channel: 'msedge',
                viewport: null,
                launchOptions: {
                    headless,
                    args: ['--start-maximized'],
                },
            },
        },
        {
            /* API specs — no browser. Delete alongside `lib/api/` if unused. */
            name: 'api',
            testMatch: /api[\\/]/,
        },
    ],

    outputDir: 'test-results/',
});

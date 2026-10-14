import test from '@lib/BaseTest';
import { expect } from '@playwright/test';
import { userLogin } from '@pages/common/login';
import { defaultUsers } from '@data/auth_data';
import { recordData } from '@data/testData';
import { projectProfile } from '@config/projectProfile';

/**
 * Reference spec — the shape every generated test follows.
 *
 * Not a real test: the selectors and data it depends on are still `CHANGE_ME` placeholders, so it
 * fails until the harness is pointed at a real application. That is deliberate — it doubles as the
 * end-to-end check in PROJECT-PROFILE.md section 11. Once it passes, the harness is wired up.
 *
 * What it demonstrates, in the order the invariants are numbered:
 *   I1  every UI action goes through a page object method, never a raw locator in this file
 *   I2  `test` imported as the default export from `@lib/BaseTest`, `expect` from `@playwright/test`,
 *       and only the fixtures the test actually uses destructured
 *   I3  domain values come from `data/testData.ts`
 *   I4  credentials come from `data/auth_data.ts` via `userLogin` in a `beforeEach`
 *   I5  assertions compare against runtime-obtained values, not numbers copied from a manual run
 *   I6  no URL or DB detail written literally — it all comes from `.env` via `appConfig`
 *   I7  any locator that could match several elements is scoped inside the page object
 *
 * Tag convention (read by the generator agent from `specs/RegressionTags/regression-tags.md`):
 *   Priority 1 -> ['@Regression', '@Priority1', '@<Module>']
 *   Priority 2 -> ['@Regression', '@Priority2', '@<Module>']
 *   Priority 3 -> ['@Priority3', '@<Module>']   (no @Regression)
 */
test.describe('Example — harness wiring check', () => {
    test.beforeEach(async ({ loginPage, dashboardPage }) => {
        // The full-access role, whatever this project calls it — `baselineRole` in config/projectProfile.ts.
        await userLogin(loginPage, dashboardPage, defaultUsers.baseline);
    });

    test(
        'Validate that the dashboard loads for an authenticated user',
        { tag: ['@Regression', '@Priority1', '@CHANGE_ME_Module'] },
        async ({ dashboardPage }) => {
            await test.step('Given the user is logged in, the dashboard renders', async () => {
                expect(await dashboardPage.isLoaded()).toBe(true);
            });
        }
    );

    test(
        'Validate that the dashboard tiles match the records held in the database',
        { tag: ['@Regression', '@Priority2', '@CHANGE_ME_Module'] },
        async ({ dashboardPage }) => {
            test.skip(!projectProfile.dbValidationEnabled, 'Database validation is out of scope — PROJECT-PROFILE.md section 5');
            await test.step('When the dashboard has loaded', async () => {
                expect(await dashboardPage.isLoaded()).toBe(true);
            });

            // A UI success state is not proof of correctness — this compares the screen against
            // the database rather than against itself.
            await test.step('Then every tile shown matches a group in the database', async () => {
                await dashboardPage.expectGroupsMatchDatabase();
            });
        }
    );

    test(
        'Validate that test data is referenced by key rather than written inline',
        { tag: ['@Priority3', '@CHANGE_ME_Module'] },
        async ({ dashboardPage }) => {
            await test.step('Given a known record identifier from data/testData.ts', async () => {
                // The point of the assertion: the value came from a named key, not a literal
                // typed into this file. Replace this step with a real search once testData.ts is
                // filled in.
                expect(recordData.validIdentifier).not.toBe('CHANGE_ME');
                expect(await dashboardPage.isLoaded()).toBe(true);
            });
        }
    );
});

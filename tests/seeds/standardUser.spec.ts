import test from '@lib/BaseTest';
import { userLogin } from '@pages/common/login';
import { testUsers } from '@data/auth_data';

/**
 * Start as `standardUser` — the page an agent explores from when it needs to be logged in as this role.
 *
 * `standardUser` is one of the template's example roles. Your application has its own — one per kind of user
 * that logs in, in camelCase. For example:
 *
 *   an HR system      admin, hrManager, employee
 *   a store           storeAdmin, warehouseStaff, customer
 *   a case system     supervisor, caseWorker, auditor (read-only)
 *
 * For each role, copy this file to tests/seeds/<role>.spec.ts and change the role in the two places below —
 * the test title and `testUsers.<role>`. Delete the files for roles you do not have. The context-builder
 * offers to do all of this for you.
 *
 * Agents pass this file to `generator_setup_page` as its seed. The login runs inside the test runner,
 * which reads the password from `.env`; the agent is handed an already signed-in page and never sees the
 * credential. That is why `.env` is unreadable to agents (`.claude/settings.json`).
 *
 * One file per role in `config/projectProfile.ts`, named after the role — `npm run check:docs` checks
 * the two match. Keep it to the login: the agent explores from wherever this test ends. The filename
 * deliberately does not contain "seed": Playwright falls back to the first such file when no seed is
 * named, and that fallback must stay the unauthenticated `tests/seed.spec.ts`.
 */
test('start as standardUser', async ({ loginPage, dashboardPage }) => {
    await userLogin(loginPage, dashboardPage, testUsers.standardUser);
});

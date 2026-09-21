# Setting the harness up for a new project

Roughly an hour end to end, most of it in steps 3 and 6. Work in order — later steps assume earlier ones.

Everything you edit is listed here. If you find yourself editing something that isn't, it probably belongs
in `PROJECT-PROFILE.md` instead.

---

## 0. Take a copy

This repository is a template. Work in a copy, never in the template itself — the template stays free of
application-specific content so the next project can start clean.

```bash
gh repo create <org>/<app>-tests --private --template <org>/ai-qa-harness --clone
```

Or without git history:

```bash
git clone --depth 1 <template-url> <app>-tests && rm -rf <app>-tests/.git && git -C <app>-tests init
```

Everything below happens inside that copy.

## 1. Install

```bash
npm install
npx playwright install
```

## 2. Fill in the project profile

Open **`PROJECT-PROFILE.md`** and work through sections 1–8. This is the file both the TypeScript layer and
all four AI agents read to learn what your application is, so vague answers here produce vague test plans.

Sections that matter most:

- **Section 2 (Roles)** — the planner uses this to decide which roles a story implicates and which
  permission boundaries to test. Name the baseline full-access role explicitly.
- **Section 3 (Domain vocabulary)** — the entities the planner is forbidden to write as literals. Anything
  missing here will end up hardcoded in a test.
- **Section 7 (Severity rubric)** — replace the examples with your own quality plan's wording. The healer
  classifies every confirmed defect against it.

Then mirror sections 1, 2, and 5 into **`config/projectProfile.ts`**: the `roles` array, the
`baselineRole`, and the DB/API flags.

## 3. Configure the environment

```bash
cp .env.example .env
```

Fill in `.env`. Required to run anything: `APP_NAME`, `TRACKER_PROJECT_KEY`, `BASE_URL`, and one
`<ROLE>_EMAIL`/`<ROLE>_PASSWORD` pair per role you'll actually test.

The role env var name is the role key from `projectProfile.ts`, uppercased, with camelCase split on the boundary: `caseWorker` → `CASE_WORKER_EMAIL`
and `CASE_WORKER_PASSWORD`.

`.env` is gitignored. Never put a credential anywhere else — `data/auth_data.ts` reads them at runtime and
throws a clear error if a role is unconfigured, which is the behavior you want.

If the project has no database, set `DB_VALIDATION_ENABLED=false` and skip the `DB_*` block. If it has no
API, leave `API_TESTS_ENABLED=false`.

## 4. Point the two shipped page objects at the real application

`pages/LoginPage.ts` and `pages/DashboardPage.ts` ship wired into the fixtures and the login helper, with
`CHANGE_ME` selectors. Replace those selectors with the real ones.

Prefer role- and label-based locators (`getByRole`, `getByLabel`) over XPath where the application gives
you the choice — they survive markup changes that a positional XPath does not.

Then verify the round trip:

```bash
npx playwright test tests/example.spec.ts --grep "@Priority1"
```

The first test passing means login and the dashboard are wired correctly. That is the milestone worth
stopping at — everything after this builds on it.

## 5. Fill in test data

**`data/testData.ts`** — replace the `CHANGE_ME` keys with the entities from PROJECT-PROFILE.md section 3.
Keep the shape: a valid case, an unknown case, a malformed case, a terminal-state case. Those four cover
most of what the planner's EP and error-guessing scenarios ask for.

Fill in `boundaries` with the application's real limits — the planner's BVA scenarios read them.

`adversarialInput` is generic; leave it unless the application has its own known-bad inputs worth adding.

**`data/sql_queries.ts`** — replace the example keys. If DB validation is out of scope, delete all but
`healthCheck`.

Then:

```bash
npm run db:check
```

## 6. Document the navigation flows

For each role in PROJECT-PROFILE.md section 2, copy
`specs/UserFlowsUserRolePermissions/_roleNavigationFlow.template.md` to `<role>NavigationFlow.plan.md` and
fill it in. List them in `userFlows.plan.md`, then build the permission matrix in
`crossRoleAccessControl.plan.md`.

This is the step most worth not skipping. Both the planner and generator read these files before tracing a
flow through `pages/` themselves, and the healer checks them before calling a blocked action a defect. An
empty set of flow plans means all three agents re-derive navigation every run, and the healer will
eventually report a working permission boundary as a bug.

You do not need every flow documented before writing the first test — start with the baseline role's happy
path and grow it.

## 7. Register your modules

In `specs/RegressionTags/regression-tags.md`, fill the module tags table from PROJECT-PROFILE.md section 4.
The generator looks up a scenario's module here; anything unregistered makes it stop and ask.

## 8. Decide what to delete

- **No API tests?** Delete `lib/api/`, the `apiClient` fixture in `lib/BaseTest.ts`, and the `api` project
  in `playwright.config.ts`.
- **No database?** Delete `config/DbConnection.ts`, `config/testDbConnection.ts`, the `db:check` script,
  the `mssql` dependencies, and `expectGroupsMatchDatabase` in `DashboardPage.ts`.
- **Only one browser?** Drop the `edge` project from `playwright.config.ts`.

## 9. Verify

Walk the checklist in PROJECT-PROFILE.md section 9, then:

```bash
npm run typecheck
npx playwright test tests/example.spec.ts
```

Once `example.spec.ts` passes end to end, the harness is wired. Keep it as a smoke check or delete it —
it is a reference, not coverage.

---

## Then: the first real test

1. Paste a story into a conversation and run `/playwright-test-planner`. Work through its checkpoints —
   it will ask about scope, about the invariants, and about scenario titles before writing anything.
2. Review `specs/<KEY>.plan.md`.
3. Run `/playwright-test-generator` against it. It drives the real browser first, then asks you to confirm
   the target file path, then writes the spec plus any page objects it needed.
4. Run the suite. If something fails, `/playwright-test-healer`.

## Common setup problems

**`Required environment variable BASE_URL is not set`** — `.env` missing or unpopulated. That error is
deliberate: the harness refuses to run against a default URL rather than silently test the wrong system.

**`Credentials for role 'x' are not configured`** — a role in `projectProfile.ts` has no
`<ROLE>_EMAIL`/`<ROLE>_PASSWORD` pair in `.env`. Add it, or remove the role from the `roles` array.

**`Project profile not configured: ... still set to CHANGE_ME`** — `APP_NAME` or `TRACKER_PROJECT_KEY`
unset in `.env`.

**Database unreachable** — `config/DbConnection.ts` prints what is wrong and what to do, including the
firewall rule to add when a server is refusing your IP. It latches that failure so the rest of the run
fails fast instead of spending a full connect timeout per test.

**An agent says a section is still a placeholder** — it found `<...>` in `PROJECT-PROFILE.md`. Fill that
section in; the agents refuse to invent your application's vocabulary, which is the point.

# Component Reference

Every file in the harness: what it is, how you use it, how you extend it, and what to expect when it
goes wrong.

Ordered by how often you touch it — configuration first, then the layers a test passes through.

---

## Configuration layer

### `PROJECT-PROFILE.md`

**What** The single source of project identity. Nine sections: application, roles, domain vocabulary,
modules, data layer, API layer, severity rubric, file layout, setup checklist.

**Who reads it** All four AI agents, every run, before doing anything else. You, when onboarding.

**How to use** Fill in every `<...>` placeholder. Delete rows that don't apply. Never delete a section
heading — the agents look sections up by name and number.

**What to expect** The quality of everything downstream tracks the quality of this file. A vague section 3
produces test plans with hardcoded values, because the planner only forbids inlining the terms you listed.
An empty section 2 produces plans that ignore permission boundaries entirely.

**Failure mode** An agent reports "section N is still a placeholder" and stops. That is deliberate — the
agents refuse to invent your application's vocabulary rather than guess at it.

---

### `config/projectProfile.ts`

**What** Machine-readable mirror of PROJECT-PROFILE.md sections 1, 2 and 5, for the TypeScript side.

**Exports**

| Export | Purpose |
|---|---|
| `roles` | `as const` tuple of role keys. Drives `Role`, and `auth_data.ts` derives its credential set from it. |
| `Role` | Union type of the role keys, so a typo in a role name is a compile error. |
| `projectProfile` | The resolved profile object. |
| `assertProfileConfigured()` | Throws if `appName` or `trackerProjectKey` is still `CHANGE_ME`. |

**How to extend** Adding a role is one edit here (`roles`), one pair of variables in `.env`, and one row in
PROJECT-PROFILE.md section 2. `data/auth_data.ts` needs no change — it derives from `roles`.

**What to expect** `dbValidationEnabled` defaults to true and `apiTestsEnabled` defaults to false, so a
project that ignores both flags still gets DB behavior and no API project.

---

### `config/testConfig.ts`

**What** Every environment-derived value, in one object. This is invariant I6's implementation.

**Key detail** `baseUrl` and `api.baseUrl` are **getters** that call `required()`. They throw when unset
rather than falling back to a default. That is the point: a harness with a default URL silently tests the
wrong system, and the run looks green.

**Exports** `appConfig` (the whole config), `getDbConfig()`.

**How to extend** Add a value as `optional('MY_VAR', 'fallback')` when a sane default exists, or
`required('MY_VAR')` when there isn't one. Add it to `.env.example` in the same commit.

**What to expect on failure**

```
Required environment variable BASE_URL is not set.
  Copy .env.example to .env and fill it in — see PROJECT-PROFILE.md section 10.
```

---

### `config/DbConnection.ts`

**What** SQL Server connection pool via `mssql`, with two pieces of hard-won failure handling.

**The two behaviors worth knowing**

1. **Config guard.** An unset `DB_SERVER` used to reach the driver as an empty host and come back as
   `Failed to connect to :1433` under a wall of driver frames — which reads like an outage rather than a
   missing `.env`. `assertDbConfigured()` now catches it before connecting and names the missing variables.

2. **Persistent-refusal latch.** When the server refuses for a reason that won't clear on its own — a
   firewall rule that doesn't cover this machine's IP, or rejected credentials — the failure is latched.
   Every later connection attempt in that worker fails instantly instead of sitting through its own connect
   timeout. Without it, a blocked IP costs the full timeout *per test*, so a suite of any size burns its
   entire run failing everything for one environmental reason — and the report reads like a mass regression
   rather than a single misconfiguration.

   Transient faults (a dropped socket, a momentary timeout) are deliberately **not** latched — those can
   recover within a run, and latching on them would let one blip void everything after it.

**Methods** `getConnection()`, `executeQuery(sql)`, `executeUpdate(sql)`,
`executePreparedStatement(sql, params)`, `close()`.

**How to use** Never from a spec file. A page object method opens it, queries, and closes it in a `finally`
— see `DashboardPage.expectGroupsMatchDatabase()` for the shape.

**Different engine?** Swap the driver here and reshape `appConfig.db` in `testConfig.ts` together. Keep
those five method signatures — the rest of the harness and every agent depends on them.

---

### `config/testDbConnection.ts`

**What** `npm run db:check`. Runs `DB_SMOKE_QUERY` from `.env`, so it never needs editing per project.

**What to expect** Exit 0 and a printed result table on success. Exit 1 and a message — no driver stack —
on failure. Skips entirely and exits 0 when `DB_VALIDATION_ENABLED=false`.

---

### `playwright.config.ts`

**What** Three projects: `chromium`, `edge`, `api`. The browser projects ignore `tests/api/`; the `api`
project matches only it and launches no browser.

**Defaults and why** `fullyParallel: false` and `workers: 1` — tests share application state and seed data,
and parallelising before the data is isolated per test turns failures unreadable. Headed by default
(`HEADLESS=true` in CI), because this suite is normally watched while it runs.

**Extend** Add a project per browser channel or device profile. Delete the `api` project if the project has
no API surface.

---

### `tsconfig.json`

Path aliases, used by every import in the harness:

| Alias | Resolves to |
|---|---|
| `@lib/*` | `lib/*` |
| `@pages/*` | `pages/*` |
| `@config/*` | `config/*` |
| `@data/*` | `data/*` |
| `@common/*` | `pages/common/*` |

Playwright resolves these natively. `ts-node` needs `-r tsconfig-paths/register`, which the `db:check`
script already passes.

---

## Data layer

### `data/auth_data.ts`

**What** Credentials, resolved from `.env` at the moment of use. Invariant I4's implementation.

**Why it's built this way** A harness that ships credentials in source is one `git push` from leaking them,
and rotating a password means editing code instead of an environment. Nothing in this file holds a value.

**Resolution** Role key → env var name, camelCase split on the boundary, uppercased:
`caseWorker` → `CASE_WORKER_EMAIL` / `CASE_WORKER_PASSWORD`.

**Exports**

| Export | Use |
|---|---|
| `testUsers` | Proxy keyed by role — `testUsers.admin`. Resolves lazily. |
| `defaultUsers` | Named getters for the common roles, plus `.invalid` for negative-path tests. |
| `defaultUser(role)` | Typed accessor when the role is computed. |
| `UserCredentials` | The `{ email, password, role? }` shape. |

**Lazy on purpose** A suite exercising two of the project's roles isn't blocked by the others being
unconfigured. The throw lands at first use, not at import.

**What to expect on failure**

```
Credentials for role 'admin' are not configured.
  Set ADMIN_EMAIL and ADMIN_PASSWORD in .env — see .env.example.
```

---

### `data/testData.ts`

**What** Every domain value a test touches, under a named key. Invariant I3's implementation.

**The four shapes that matter** `recordData` ships with a valid case, an unknown case, a malformed case,
and a terminal-state case. Those four cover most of what the planner's equivalence-partitioning and
error-guessing scenarios ask for — keep the shape even as you rename the keys.

| Export | Holds |
|---|---|
| `recordData` | The core entity's identifiers, in the four states above. |
| `ownerData` | Who a record is assigned to — primary, secondary (for cross-ownership tests), empty. |
| `groupData` | The organizational unit records file under. |
| `boundaries` | Real application limits. The planner's BVA scenarios read these. |
| `adversarialInput` | Empty, whitespace, long string, special characters, unicode, padded. Generic — leave as-is unless the application has its own known-bad inputs. |

**Keep in sync with** PROJECT-PROFILE.md section 3. That table is what the planner treats as forbidden to
inline; a term missing from it will end up hardcoded in a test.

---

### `data/sql_queries.ts`

**What** Every query the suite runs. Invariant I3 again, for the database side.

**Conventions** (the agents follow these when adding a key)

- Name the key for what it answers, not how: `getOpenRecordsForOwner`, not `selectFromRecords`.
- Parameterless query → a string. Parameterized → a function returning a string.
- Parameterize through `executePreparedStatement` for anything derived from test input. String
  interpolation is acceptable only for values the test itself controls, never for values that came from the
  page.
- Read-only unless the key name says otherwise (`unlock...`, `reset...`).

**What the agents will not do** Invent SQL. They have no schema visibility, so a query they wrote would be
plausible and wrong. They ask you for the text, then add it under these conventions.

---

## Fixture layer

### `lib/BaseTest.ts`

**What** The Page Factory. Invariant I2's implementation, and the file the generator agent reads to learn
your fixture names.

**Why fixtures rather than `new SomePage(page)`** One construction site per page object, so a constructor
change is a one-line edit rather than a grep across the suite. And a test's dependencies are visible in its
own signature.

**Adding a page object** Three edits, in order: import it, add its field to `Fixtures`, add its factory to
`test.extend`.

**Naming** camelCase of the class: `RecordListPage` → `recordListPage`. The generator reads this file for
exact names, so a fixture that breaks the convention is one it won't find.

**Ships with** `loginPage`, `dashboardPage`, `logout`, `apiClient`.

---

### `lib/api/ApiClient.ts`

**What** Thin API client. The `apiClient` fixture hands it a request context with auth already attached, so
nothing in this file touches credentials.

**When to keep it** Only when `API_TESTS_ENABLED=true`. Otherwise delete `lib/api/`, the `apiClient`
fixture, and the `api` project in `playwright.config.ts`.

**Extend** One method per endpoint, named for the operation rather than verb-plus-path.

---

## Page object layer

### `pages/BasePage.ts`

**What** Shared behavior for every page object. Abstract — page objects extend it.

| Method | Use |
|---|---|
| `goto(path)` | Navigate relative to `BASE_URL`. |
| `url()` | Current URL, for landing assertions. |
| `waitForVisible(locator, ms)` | Wait for actionability. Use this over a fixed `waitForTimeout` — a sleep either wastes time or is too short on a slow run, and it hides the real condition from whoever reads the test later. |
| `readColumn(rows, cellSelector)` | Read a table column as strings, for set-membership and before/after comparisons (I5). |
| `expectMatchesDatabase(ui, db)` | Order-insensitive comparison. If ordering is what's under test, assert it explicitly instead. |
| `firstOf(locator)` | Scope an ambiguous locator to one match (I7). |

**Rule of thumb** A helper here must be genuinely page-agnostic. The moment it needs to know about a
specific screen, it belongs on that screen's page object.

---

### `pages/LoginPage.ts` · `pages/DashboardPage.ts`

**What** The two page objects that ship wired — into the fixtures, into `userLogin`, and into
`example.spec.ts`. Selectors are `CHANGE_ME` placeholders.

**Setup** Replace the selectors. Prefer `getByRole` / `getByLabel` over XPath where the application gives
you the choice — they survive markup changes a positional XPath doesn't.

**`DashboardPage.expectGroupsMatchDatabase()`** is the reference DB-backed assertion: query from
`sql_queries.ts`, executed through `DbConnection`, compared inside the page object. Copy this shape; a spec
file never opens a connection or writes SQL itself.

**Locator convention** (I1, I7) `readonly` property, initialized once in the constructor, referenced as
`this.<name>`. Never a `page.locator(...)` built inline inside a method body — a locator defined at the
point of use is invisible to anyone auditing what the page depends on, and is where ambiguous selectors
creep in.

---

### `pages/common/`

`login.ts` exports `userLogin(loginPage, dashboardPage, credentials)` — logs in and confirms the session
started, so a test reaching its first real step knows it is genuinely authenticated. Called from
`test.beforeEach`, never inline.

`Logout.ts` is the shared chrome widget. Widgets reachable from every page (nav bar, search box, toast
container) live in `common/`; screen-specific page objects live in `pages/`.

---

## Specs layer

| File | Role |
|---|---|
| `specs/TEMPLATES/plan-template.md` | Canonical plan shape, with the field rules spelled out. |
| `specs/TEMPLATES/plan-template.csv` | Matching CSV header and two worked rows. |
| `specs/RegressionTags/regression-tags.md` | Tag registry. The generator looks up a scenario's module here and will not invent a name — it asks, then writes the row itself. Includes a Gotchas section covering false-positive `--grep` matches. |
| `specs/ScenarioGenerationPatterns/pageWiseAndRoleWiseCoverage.plan.md` | When and how to replicate a scenario set across pages and roles, and which checks are exceptions. The planner reads it at flow analysis. |
| `specs/UserFlowsUserRolePermissions/` | Per-role navigation and permission plans, plus the cross-role matrix. |

**The navigation plans are the highest-leverage docs here.** The planner and generator both read them
before tracing a flow through `pages/` themselves, and the healer checks them before calling a blocked
action a defect. Leave them empty and all three agents re-derive navigation every run — and the healer will
eventually report a working permission boundary as a bug.

You don't need them complete before the first test. Start with the baseline role's happy path.

---

## Tests layer

### `tests/example.spec.ts`

Reference spec, not coverage. Three tests demonstrating I1–I7 and the full tag convention. Fails until the
harness is pointed at a real application — which doubles as the end-to-end check in PROJECT-PROFILE.md
section 10. Once it passes, the harness is wired. Keep it as a smoke check or delete it.

### `tests/seed.spec.ts`

The generator's live-drive starting point. Body stays empty; generated tests go to their own files.

### `tests/common/login.ts`

Re-export of `pages/common/login.ts`. A pointer, not a second copy — specs conventionally import test-side
helpers from `tests/common/`, and keeping two implementations in sync is a bug waiting to happen.

---

## Commands

| Command | Does |
|---|---|
| `npm test` | Full suite |
| `npm run test:regression` | `--grep "@Regression"` |
| `npm run test:headed` / `test:debug` / `test:ui` | Watched, stepped, interactive |
| `npm run test:api` | The `api` project only |
| `npm run db:check` | Database connectivity |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run report` | Open the last HTML report |
| `npm run setup` | `playwright install` |

Tag filtering:

```bash
npx playwright test --grep "@Priority1"
npx playwright test --grep "(?=.*@Regression)(?=.*@YourModule)"
```

# Component Reference

Every file in the harness: what it is, how you use it, how you extend it, and what to expect when it
goes wrong.

Ordered by how often you touch it — configuration first, then the layers a test passes through.

---

## Knowledge layer

### `agents/`

**What** The five agent definitions, canonical and vendor-neutral — plain markdown with no tool's
frontmatter and no tool's tool names. Each opens with a header stating its role, interaction model, file
access, MCP servers and model guidance.

**How to use** Edit these. `.claude/commands/*.md` are one-line wrappers that point here and deliberately
carry no prose, so the two cannot drift. Their frontmatter sets the model and *pre-approves* the tools each
agent uses (`allowed-tools`) so they run without a prompt — it restricts nothing; the restrictions are in
`.claude/settings.json`. `agents/README.md` covers porting to another agentic tool.

---

### `.claude/settings.json`

**What** The harness's permission rules for Claude Code — shipped and committed, so they apply to everyone.

| Rule | Covers |
|---|---|
| Deny | Reading `.env` and `.mcp.json`; the database server's write tools; Jira deletes, worklogs, sprints, boards, versions, project admin |
| Ask | Creating, editing, moving, linking, commenting on or attaching to a Jira issue |
| Allow | The read-only database and Jira tools |

**How to use** The rules name tools as `mcp__database__<tool>`, and Jira's for both routes —
`mcp__tracker__<tool>` and the Atlassian plugin's `mcp__plugin_atlassian_atlassian__<tool>` — so they follow
the server keys in `.mcp.json`. Database writes are denied rather than asked because nothing in the harness
needs them; move them to `ask` deliberately if that changes. Change a key, or choose a different server, and update the names. Personal
overrides go in `.claude/settings.local.json`, which is gitignored.

**What to expect** A second line behind the agents' own instructions, not a sandbox — a shell command can
still read a file the `Read` rule denies. For the database, the read-only account remains the real guard.

**What to expect** Changing an agent's behavior is one edit in one file, regardless of how many tools you
have wired up.

---

### `context/`

**What** Everything the harness knows about your application beyond the profile. `BASELINE.md` is the
inventory — sources, modules, roles, vocabulary, data layer, and a known-unknowns section.
`<area>.md` documents carry per-area business rules, states and transitions, recipes and verification
queries — and an *Existing coverage* summary of earlier test cases. `_TEMPLATE.md` is the shape;
`README.md` is the convention. `sources/` is where the team drops existing documents for the
context-builder to read — specs, business rules, test cases, bug lists, and Jira issues exported as CSV when
Jira is not connected. Committed with the QA repo, so every rule can be checked against its source.

**Why it exists** The harness is a separate repository from the application, so it has no sight of your
source, schema or API. This is the only durable channel for that knowledge.

**How to use** `/playwright-context-builder` writes the first pass; you correct it. Distil, never dump — a
schema dump buries the few facts that matter.

**What to expect** The known-unknowns section is the deliverable, not the leftovers. A recorded gap makes
the agents ask; a guessed one makes them confidently wrong.

**Failure mode** Drift. A context document that no longer matches reality is worse than none, because an
agent will act on it confidently. Fix the document in the same change as the test that caught it.

---

### `.mcp.json`

**What** How agents reach the browser and, optionally, the database and the issue tracker. Copied from
`.mcp.json.example`; gitignored, because the database entry carries a password.

**The required entry** `playwright-test` — `npx playwright run-test-mcp-server`, which ships with
`@playwright/test`, nothing extra to install. Three of the five agents cannot work without it.

**The optional entries**
- `database` — `@executeautomation/database-server`, PostgreSQL or SQL Server, version pinned. Biggest
  single reduction in friction available: with it, agents read your schema rather than asking you for
  every query. It has no read-only mode, so give it a read-only account.
- `tracker` — Jira through Atlassian's remote MCP server, signed in with `/mcp`. The planner fetches stories
  by key, the defect-raiser creates bugs, the healer reads bug status and records retest results. Keep
  `?tools=all` and the key `tracker`; `.claude/settings.json` depends on both. The Atlassian plugin is the
  alternative — use one, not both.

**What to expect** Introspection reports structure, and not always correctly — confirm anything surprising
with a direct query before writing it into a context document. Full reasoning in
[MCP.md](MCP.md).

---

### `docs/`

**What** The documentation set. `index.html` is the handbook — a self-contained page covering setup, the
agents, the components and the workflows. Alongside it, this file, `AGENTS.md`, `WORKFLOWS.md` and
`MCP.md` carry the deeper per-topic reference, and `NEW-QA-REPO.md` is the step-by-step for starting a
project's QA repository. `qa-harness-intro.html` is a three-slide deck for
introducing the harness to a QA team — how a story is tested by hand today, how it is tested with the
harness, and what changes for them. Open it in a browser; arrow keys move between slides, F goes full
screen, and printing gives one slide per page. `qa-harness-walkthrough.html` follows one example through a
whole cycle — setup, one ticket, regression and closure — showing for each step what you run, what the
harness asks and what comes out; the handbook's *Follow a whole cycle* covers the same in reference form.

**How to use** `npm run docs` opens the handbook. The markdown files are read in place, and are also what
the agents read when they need a convention rather than an instruction.

**What to expect** These restate things the code owns, so they drift. `npm run check:docs` catches the
mechanical cases — agent rosters, section totals, directory coverage, broken links, vendor neutrality.
Prose still needs a reader.

**Template or copy** `check:docs` knows which it is running in from the `name` in `package.json`. In the
template it checks everything. In a project copy it skips vendor neutrality and directory coverage — a copy
is supposed to name its application and grow directories of its own — and keeps the rest: agent/wrapper
pairing, thin wrappers, section and invariant totals, links, and that `.gitignore` keeps `.env` and
`.mcp.json` out of git.

---

### `scripts/`

**What** Maintenance and reporting scripts, not part of the test suite.

| Script | Backs | Does |
|---|---|---|
| `open-docs.js` | `npm run docs` | Opens the handbook |
| `export-harness.js` | `npm run export -- <dir>` | Copies the harness into a project's QA repository |
| `check-docs.js` | `npm run check:docs` | Asserts the docs still match the repository |
| `check-trace.ts` | `npm run check:trace` | Enforces I8 — TCIDs present, planned, unique, not retired |
| `regression.ts` | `npm run regression` | Regression for a client release, on the tickets or epics you choose |
| `cycle-report.ts` | `npm run report:cycle` | Rebuilds the test-cycle closure report by hand, for any scope |
| `lib/cycle.ts` | — | Builds the cycle report — used by the two above and by `lib/cycleReporter.ts` |
| `lib/trace.ts` | — | The one parser all of them share, so they cannot disagree about what a TCID is |

---

### `scripts/check-trace.ts`

**What** `npm run check:trace` — enforcement for I8, traceability. Part of `npm run check`.

**Checks** Plan files are named for a valid story key; plan TCIDs are well-formed, unique and belong to
their story; every AC in a plan's traceability table links to real scenarios; every story spec has a plan;
every test in `tests/stories/` has a TCID from its own story; every TCID anywhere is in a plan, used by
exactly one test, and not retired.

**Warns, but does not fail** An AC with no test case; a `test.fixme` with no `// Defect` comment; tests
outside `tests/stories/` carrying no TCID — allowed, but invisible to AC coverage.

**What to expect** Passes trivially on a fresh template, since there are no plans yet.

---

### `scripts/regression.ts`

**What** `npm run regression` — regression for a client release. Asks which release, then which of its
tickets — all, by epic, or one by one — and whether to run only tests tagged `@Regression`; shows the
selection, runs it, and the cycle report for exactly that selection is written as the run ends.

**Where releases and epics come from** Each plan's `**Release:**` and `**Epic:**` — filled by the planner,
from Jira's fix version and parent epic when the tracker is connected. A story with no `**Release:**` falls
back to the folder its spec lives in, `tests/stories/<release>/`; one with neither is listed as *no release*
(`--release none`) — its spec sits under its epic's key or directly in `tests/stories/`, and a folder named
like an issue key is never read as a release. These are the project's own releases; the harness's version
never appears in them.

**Without a terminal** Pass the answers as flags — `--release`, `--epics`, `--stories`, `--all-tests`,
`--browser`, `--yes`. An agent asks you in the conversation, then runs it that way.

---

### `scripts/cycle-report.ts`

**What** `npm run report:cycle` — the STLC test-cycle closure report, by hand. The same report is written
automatically when any run ends (`lib/cycleReporter.ts`), scoped to the stories that ran; use this to
rebuild it after recording manual results, or for another scope: `--release 2.26`, `--stories PROJ-12,PROJ-15`,
or nothing for every story; `--since <date>` ignores results from before the cycle began. Written to
`reports/cycle-summary-<scope>-<time>.md`, which is not committed — or, with `--closure`, to
`specs/execution/closure/`, which is: the cycle's final report, kept for the record.

**Reads** Plans, `specs/execution/automated-results.csv` (each test case's latest result across runs),
`specs/execution/manual-results.csv` and `specs/defects/defect-log.json` — all optional; it says plainly which
were missing. It names the build under test (`BUILD_UNDER_TEST`) and warns when results come from several.

**Reports** Every active test case and how it ended (Passed · Flaky · Failed · Blocked by a `fixme` ·
Skipped · Not Run), pass rates by priority, acceptance-criteria coverage per story, open defects by
severity, traceability gaps, and each exit criterion from PROJECT-PROFILE.md section 10 as met or not.

**What to expect** It states facts; it does not decide. `--strict` exits non-zero when a criterion is
unmet, for use as a gate — by default it only reports, because closing a cycle is a person's call.

---

### `scripts/export-harness.js`

**What** `npm run export -- <dir>` — copies the harness into a project's QA repository. Template only; it
is not copied, since a copy has nothing to export.

**Copies** Every tracked file except `README.md`, `CHANGELOG.md` and itself — dotfiles included. A
hand-made copy most often misses `.gitignore`, and without it `.env` is committed on the first push.

**Also** Names the package after the target folder, writes a starter README if the target has none,
records the harness version — the newest `CHANGELOG.md` entry — and commit in PROJECT-PROFILE.md section 1,
and runs `check:docs` against the copy. The copy's `package.json` version is left at `0.0.0`: the harness's
version is not the project's, and nothing should suggest it is.

**What to expect** It never overwrites — any existing file it would write stops it before it writes
anything. It refuses a template with uncommitted changes unless given `--allow-dirty`, which records the
commit as `<sha>-dirty`.

---

### `scripts/open-docs.js`

**What** `npm run docs`. Opens the handbook in the default browser, cross-platform.

**Why a script rather than a URL** The handbook is a local file by decision, not omission: GitHub Pages
does not inherit repository privacy, so publishing it would make the docs public even with the repo
private. The template's README records the full reasoning.

---

## Configuration layer

### `PROJECT-PROFILE.md`

**What** The single source of project identity. Eleven sections: application, roles, domain vocabulary,
modules, data layer, API layer, severity rubric, file layout, knowledge sources, test strategy (scope,
entry and exit criteria), setup checklist.

**Who reads it** All five agents, every run, before doing anything else. You, when onboarding.

**How to use** Fill in every `<...>` placeholder. Delete rows that don't apply. Never delete a section
heading — the agents look sections up by name and number.

**What to expect** The quality of everything downstream tracks the quality of this file. A vague section 3
produces test plans with hardcoded values, because the planner only forbids inlining the terms you listed.
An empty section 2 produces plans that ignore permission boundaries entirely.

**Failure mode** An agent reports "section N is still a placeholder" and stops. That is deliberate — the
agents refuse to invent your application's vocabulary rather than guess at it.

---

### `config/projectProfile.ts`

**What** Machine-readable mirror of PROJECT-PROFILE.md sections 1, 2, 5 and 10, for the TypeScript side.

**Exports**

| Export | Purpose |
|---|---|
| `roles` | `as const` tuple of role keys. Drives `Role`, and `auth_data.ts` derives its credential set from it. |
| `Role` | Union type of the role keys, so a typo in a role name is a compile error. |
| `ExitCriteria` | The shape of the exit-criteria thresholds. |
| `projectProfile` | The resolved profile object — including `storyKeyPattern`, which `check:trace` validates every story key against, and `exitCriteria`, which `report:cycle` evaluates. |

**Tighten `storyKeyPattern`** to your tracker once you know it — the default accepts any `ABC-123` shape, which
lets a typo'd project prefix through.

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

**Exports** `appConfig` — the whole configuration object.

**How to extend** Add a value as `optional('MY_VAR', 'fallback')` when a sane default exists, or
`required('MY_VAR')` when there isn't one. Add it to `.env.example` in the same commit.

**What to expect on failure**

```
Required environment variable BASE_URL is not set.
  Copy .env.example to .env and fill it in — see PROJECT-PROFILE.md section 11.
```

---

### `config/DbConnection.ts`

**What** The one database connection in the harness, for SQL Server or PostgreSQL — `DB_ENGINE` in `.env`
picks. The engine-specific parts live in `config/db/`: `mssqlAdapter.ts` (the `mssql` driver),
`postgresAdapter.ts` (`pg`), and `types.ts`, the contract between them. Each driver is loaded only when
used. Two pieces of hard-won failure handling sit on top, for both engines.

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

   Each adapter supplies its engine's persistent refusals and the advice for them — the firewall rule for an
   Azure SQL IP block, the `pg_hba.conf` entry or managed-server firewall for PostgreSQL, rejected
   credentials, a missing database, a TLS mismatch.

**Methods** `executeQuery(sql)`, `executeUpdate(sql)` (rows changed), `executePreparedStatement(sql,
params)`, `close()`. Queries return `{ rows, rowCount }`; `recordset` is the same array as `rows`, kept for
code written before PostgreSQL support.

**Parameters** Written `@name` in the SQL for both engines; the PostgreSQL adapter turns them into `$1`,
`$2`. The SQL itself is still the engine's dialect.

**How to use** Never from a spec file. A page object method opens it, queries, and closes it in a `finally`
— see `DashboardPage.expectGroupsMatchDatabase()` for the shape.

**A third engine?** Add an adapter to `config/db/` implementing `DbAdapter` and `EngineErrors`, and an
entry in `ENGINES`. Keep the four method signatures — the rest of the harness and every agent depends on
them. **Only one engine?** Uninstall the other driver, delete its adapter and its `ENGINES` entry.

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
(`HEADLESS=true` for an unattended run), because this suite is normally watched while it runs.

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
- Parameterize through `executePreparedStatement` for anything derived from test input, writing
  parameters `@name` on either engine. String interpolation is acceptable only for values the test itself
  controls, never for values that came from the page.
- Write in the project's engine dialect. On PostgreSQL, unquoted identifiers fold to lower case — alias a
  column (`SELECT name AS "Name"`) when code reads it by its mixed-case name.
- Read-only unless the key name says otherwise (`unlock...`, `reset...`).

**What the agents will not do** Invent SQL. They have no schema visibility, so a query they wrote would be
plausible and wrong. They ask you for the text, then add it under these conventions.

---

### `data/seed.ts`

**What** Test data provisioning. `resetTestData()` then `seedTestData()`, run by `lib/globalSetup.ts` when
`SEED_TEST_DATA=true`. Ships empty — what "known state" means is your application's business.

**Conventions** Statements live in `data/sql_queries.ts` as `seed…` and `reset…` keys (I3). Both idempotent.
Seed only what tests need, identified by `data/testData.ts` keys. `context/<area>.md` recipes are the natural
source. Runs with the suite's credentials from `.env`, never the agents' read-only account.

**Why it matters** Tests that depend on whatever data happens to be present cannot run in parallel, drift as
other people use the environment, and fail in ways the healer can only call "stale data".

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

**Ships with** `cleanup`, `loginPage`, `dashboardPage`, `logout`, `apiClient`.

**`cleanup`** is per-test teardown. A test that creates data registers how to remove it at the moment it
creates it — `cleanup.add('delete created record', () => recordPage.delete(id))`. Tasks run after the test
in reverse order whether it passed or failed, and a task that throws fails the test: leaked data is what
makes the next test fail for a reason nobody can find.

---

### `lib/globalSetup.ts`

**What** Runs once before every test run: the automatic half of the entry criteria in PROJECT-PROFILE.md
section 10.

**Does** Confirms the application answers at `BASE_URL` (any HTTP response counts; a 5xx does not), and
that the database is reachable if DB validation is in scope. Then, when `SEED_TEST_DATA=true`, runs
`data/seed.ts` to put test data into a known state.

**Why** A run against an environment that is down records every test as failed, for one reason, in a
report that reads like a mass regression. One clear message before anything runs is worth more.

**Escape hatch** `SKIP_READINESS_CHECK=true`, for an API-only run or a deliberate run against a failing
environment. Does not fire on `--list`.

---

### `lib/cycleReporter.ts`

**What** A Playwright reporter that, as a run ends, first records each test case's result in
`specs/execution/automated-results.csv` — so a cycle of several runs is reported as a whole — then writes the
test-cycle closure report, scoped to the stories that ran — run one ticket's spec and the report covers that ticket, not every plan with the rest
marked *Not Run*. `npm run regression` hands it its own scope: the release and tickets you selected.

**Why after the JSON reporter** It reads `test-results/results.json`, and Playwright finishes reporters in
the order listed, so it is listed last in `playwright.config.ts`.

**Escape hatch** `AUTO_CYCLE_REPORT=false` turns the report off; the results are recorded regardless. A
failure to record or report is printed and never fails the run.

### `scripts/defect-evidence.ts`

**What** `npm run defect:evidence` — copies a confirmed defect's screenshots and page snapshot out of
`test-results/`, which the next run wipes, into `specs/defects/evidence/<entry id>/`, and lists them in the
entry's `attachments`. The healer runs it when you confirm a defect; the defect-raiser attaches the files.
`--with-traces` copies the trace and video too.

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
| `expectNoAccessibilityViolations(opts)` | Run axe against the page at WCAG A/AA. Scope with `include` to the region a story changed. Tag such tests `@A11y`. Automated checks find roughly a third of accessibility problems — a pass means "no obvious barriers", not "accessible". |

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
| `specs/TEMPLATES/plan-template.md` | Canonical plan shape, with the field rules spelled out — including the story's Key, Title, Release and Epic, which regression selects by. |
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

### `specs/execution/`

**What** The cycle's execution record, committed. `automated-results.csv` — each automated test case's latest
result, written by every run. `manual-results.csv` — the record for manual test cases, which have no runner.
Columns: `TCID, Status, Executed By, Executed On, Environment, Notes`; Status is `Passed`, `Failed`,
`Blocked` or `Not Run`. `closure/` — each cycle's final report.

### `specs/defects/`

**What** Committed, so the whole team shares one defect record. `defect-log.json` — every confirmed defect
and its status (`pending` → `raised` → `verified`); `evidence/<entry id>/` — its screenshots;
`defects.csv` — bugs to import, only without a Jira connection. The cycle report counts open defects from
the log, so a regression run on any machine sees them.

**How rows arrive** The planner seeds a `Not Run` row for every `Manual` scenario when it saves a plan; a
tester updates them; `report:cycle` reads them alongside automated results. A manual case still `Not Run`
at closure counts against the exit criteria exactly as an automated one would.

---


## Tests layer

### `tests/example.spec.ts`

Reference spec, not coverage. Three tests demonstrating I1–I8 and the full tag convention. Fails until the
harness is pointed at a real application — which doubles as the end-to-end check in PROJECT-PROFILE.md
section 11. Once it passes, the harness is wired. Keep it as a smoke check or delete it.

### `tests/seed.spec.ts`

The live-drive starting point for a signed-out scenario — the login screen itself. Body stays empty;
generated tests go to their own files. It is also what Playwright falls back to when an agent names no seed,
which is why no other seed has "seed" in its filename.

### `tests/seeds/<role>.spec.ts`

One per role in `config/projectProfile.ts`; the template ships `admin`, `standardUser` and `readOnlyUser`.
Each is a single test that logs in as its role through `userLogin`, inside the test runner. Agents pass the
file to `generator_setup_page` and start from the signed-in page it leaves — so no agent ever handles a
password, and `.claude/settings.json` can deny them reading `.env`.

**Adding a role** Copy a seed, rename it to the role key, change the role in it — each shipped seed opens with
those steps and example role keys. At setup the context-builder offers to do it, along with the roles array
and the profile's rows. `npm run check:docs` fails when a role has no seed, or a seed has no role.

**What to expect** They run with the rest of the suite, as a login check per role. Not traced — they are
scaffolding, not coverage.

### `tests/common/login.ts`

Re-export of `pages/common/login.ts`. A pointer, not a second copy — specs conventionally import test-side
helpers from `tests/common/`, and keeping two implementations in sync is a bug waiting to happen.

---

## Commands

| Command | Does |
|---|---|
| `npm test` | Full suite |
| `npm run regression` | Regression for a client release — choose its tickets or epics; writes the cycle report |
| `npm run test:regression` | Every test tagged `@Regression`, no selection |
| `npm run test:headed` / `test:debug` / `test:ui` | Watched, stepped, interactive |
| `npm run test:api` | The `api` project only |
| `npm run db:check` | Database connectivity |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check:docs` | Docs still match the repository |
| `npm run check:trace` | I8 traceability holds |
| `npm run check` | All three of the above — run it before pushing |
| `npm run report` | Open the last HTML report |
| `npm run report:cycle` | Rebuild the cycle report by hand — `--release`, `--stories`, `--strict` |
| `npm run docs` | Open the handbook |
| `npm run export -- <dir>` | Copy the harness into a project's QA repository (template only) |
| `npm run setup` | `playwright install` |

Tag filtering:

```bash
npx playwright test --grep "@Priority1"
npx playwright test --grep "(?=.*@Regression)(?=.*@YourModule)"
```

# Setting the harness up for a new project

Work in order — later steps assume earlier ones.

The shape of it: get the harness talking to your application, let an agent explore it and draft what it
finds, then correct those drafts. Correcting a draft is much faster than writing one cold, which is why
step 3 comes before step 4.

Everything you edit is listed here. If you find yourself editing something that isn't, it probably belongs
in `PROJECT-PROFILE.md` instead.

---

## 0. Take a copy

**Setting up a new QA repo? Follow [docs/NEW-QA-REPO.md](docs/NEW-QA-REPO.md)** — it is the step-by-step
for exactly that: create the project's QA repository, copy the harness's files into it, and configure it
there. It lists every file that is copied and why, and the checklist to complete before the context-builder
runs. This file is the reference behind those steps.

The template itself is never configured for a project — it stays free of application-specific content so
the next project can start clean. The copy is made with:

```bash
npm run export -- <path-to-the-new-repo>
```

run from the template. It copies the files the harness needs into that folder — no clone, no git history —
and records the **harness** version (the newest entry in the template's `CHANGELOG.md`) and commit in the
copy's `PROJECT-PROFILE.md` section 1. That is the harness's version, kept apart from the project's own
release versions: those are the client's, in each plan's `**Release:**` and `tests/stories/<release>/`.

Everything below happens inside the copy.

## 1. Install

```bash
npm install
npx playwright install
```

Then open the handbook — it covers everything below in more depth, and is the fastest way to understand
what you are configuring:

```bash
npm run docs
```

## 2. Connect it to your application

Two files. The agents need both before they can do anything useful.

**Environment:**

```bash
cp .env.example .env
```

The minimum to get moving: `APP_NAME`, `TRACKER_PROJECT_KEY`, `BASE_URL`, and one
`<ROLE>_EMAIL`/`<ROLE>_PASSWORD` pair per role you intend to test. Add the rest as you go.

The env var name is the role key from `config/projectProfile.ts`, uppercased and split on the camelCase
boundary: `caseWorker` → `CASE_WORKER_EMAIL` / `CASE_WORKER_PASSWORD`. While you are there, set the `roles`
array in that file to your application's actual roles.

`.env` is gitignored. Never put a credential anywhere else — `data/auth_data.ts` reads them at runtime and
throws a clear error if a role is unconfigured, which is the behavior you want.

**Database:** set `DB_ENGINE` to `mssql` (SQL Server) or `postgres` (PostgreSQL), then the `DB_*` block.
`DB_PORT` and `DB_SCHEMA_PREFIX` default to the engine's own (1433 and `dbo`, or 5432 and `public`).

There are two database connections, for two different users:

| | The test suite | The AI agents |
|---|---|---|
| Through | The driver in `config/db/` (`mssql` or `pg`) | The `database` MCP server |
| Configured in | `.env` — the `DB_*` block | `.mcp.json` |
| Used for | DB-backed assertions, `npm run db:check`, the readiness check, `data/seed.ts` | Reading the schema while exploring; checking a failing DB-backed assertion |
| Account | Whatever the suite needs — seeding writes | Read-only, always |

Each is optional on its own. A project can have the suite's connection without the agents', or neither.

No database? Set `DB_VALIDATION_ENABLED=false` and skip the `DB_*` block. No API? Leave
`API_TESTS_ENABLED=false`.

**MCP servers:**

```bash
cp .mcp.json.example .mcp.json
```

Three entries. Delete the ones you will not use.

- **`playwright-test` — required.** The context-builder, generator and healer cannot work without a
  browser. It ships with `@playwright/test`, so there is nothing extra to install.
- **`database` — optional, high value.** With it, agents read your schema instead of asking you for every
  query. The example is PostgreSQL; the comment above it gives the SQL Server flags. This server has no
  read-only mode, so use a **read-only** account against a QA database, never production.
- **`tracker` — optional.** Jira: the planner then fetches a story from its key, the defect-raiser creates
  bugs instead of writing a CSV to import, and the healer reads bug status to know what to retest, then
  records the result. **Use whichever connection the team already has and that works.** In Claude Code,
  the Atlassian plugin is the simple route — `/plugin install atlassian@claude-plugins-official`, then
  delete this entry. With another agentic tool, keep this entry; keep `?tools=all` on the URL and the key
  `tracker`, which the guard rails depend on. Either way, sign in with `/mcp` (or your tool's equivalent).
  The context-builder confirms the connection works at setup, by fetching one story you know exists.
  [docs/MCP.md](docs/MCP.md) compares the two.

[docs/MCP.md](docs/MCP.md) has the reasoning and the caveats.

**Guard rails — `.claude/settings.json`.** Shipped and committed, so they apply to everyone using the
harness in Claude Code:

| Rule | Covers |
|---|---|
| **Deny** | Reading `.env` and `.mcp.json` — agents never see a password. The database server's write tools. Jira deletes, worklogs, sprints, boards, versions and project admin. |
| **Ask** | Creating, editing or moving a Jira issue, linking one, commenting, attaching. A person approves every write to the tracker. |
| **Allow** | The read-only database and Jira tools, so agents do not prompt on every lookup. |

Database writes are denied because nothing in the harness needs them — `data/seed.ts` writes through the
suite's own connection, not the agents'. If your team later wants an agent to write, move those tools from
`deny` to `ask` deliberately.

The rules name tools as `mcp__database__<tool>`, and Jira's as `mcp__tracker__<tool>` or — for the Atlassian
plugin — `mcp__plugin_atlassian_atlassian__<tool>`, so they depend on the server keys in `.mcp.json`. Rename a key, or choose a different database or tracker server, and update the rules
to match — `/mcp` in Claude Code lists the tools a server exposes. Personal overrides go in
`.claude/settings.local.json`, which is gitignored.

The agents' own instructions already forbid writing to the application or the database, and require
confirmation before anything is filed. These rules are the second line, for when an instruction is missed.
They are not a sandbox: Bash can still read a file the `Read` rule denies — agents have no reason to, but
the real protection for the database is still the read-only account.

### If you are not using Claude Code

The harness does not require it. Three of its four layers are vendor-neutral already:

- The **test suite** (`playwright.config.ts`, `config/`, `data/`, `lib/`, `pages/`, `tests/`) uses no AI at
  all — `npm test` runs it.
- The **knowledge layer** (`PROJECT-PROFILE.md`, `context/`, `specs/`,
  `TEST-AUTHORING-INVARIANTS.md`) is plain markdown any tool can read.
- The **agent definitions** live in [`agents/`](agents/) as plain prose with no vendor's frontmatter and no
  vendor's tool names.

Only `.claude/` is Claude-specific: the wrappers in `.claude/commands/`, which contain no instructions —
each is one line pointing at its canonical file in `agents/` — and the permission rules in
`.claude/settings.json`. To support another tool, write the equivalent one-line wrapper where that tool
looks, translate the frontmatter, recreate the permission rules, and point it at the same MCP servers.
[`agents/README.md`](agents/README.md) has the locations, the tool-name translation table, and the part
that actually matters: these definitions depend on blocking checkpoints, refusals and self-audits, and a
weaker model drops those first.

**Whichever tool you use, edit `agents/*.md`, never a wrapper.** A wrapper that grows instructions of its
own is a second copy waiting to drift.

## 3. Baseline the application

```
/playwright-context-builder
```

This is the step that answers "how does a separate repository learn anything about my application". It
will:

- check that every role can log in and the Jira connection works, and tell you what to fix
- ask you what sources exist and which are reachable — the running app, the database, the source, API
  docs, contracts, who to ask about what
- **roam the application**: the signed-out pages first — the login screen, password reset, public pages —
  then, as each role, page to page through every area it can reach, read-only, mapping modules,
  navigation paths and what each role can and cannot do
- read the project's existing knowledge — functional specs, business rules, existing test cases and bug
  history dropped in `context/sources/`, the Jira epics you name, source and API docs — and introspect the
  database if one is wired
- write `context/BASELINE.md`, and draft `PROJECT-PROFILE.md` sections 2–4, the navigation-flow plans, and
  the module tag table

### Before you run it

Work through the checklist in [docs/NEW-QA-REPO.md](docs/NEW-QA-REPO.md) section 4 — what must be done,
what is worth having, and what to decide. In short: the environment reachable; `.env` with the base URL and
one dedicated QA test account per role; the role keys in `config/projectProfile.ts` and section 2 of the
profile; one login file per role in `tests/seeds/`; the project's existing documents exported into
`context/sources/`; `.mcp.json` with the Playwright server connected; and someone available to answer its
checkpoints. The login selectors in `pages/LoginPage.ts` and `pages/DashboardPage.ts` can wait — its first
step offers to fill them.

**You do not need to test the logins yourself.** Its first step runs every role's login file and reports
per role what passed and what to fix. `npx playwright test tests/seeds/` runs the same check by hand.

**Passwords stay out of the AI conversation.** The login files read `.env` inside the test runner, and
`.claude/settings.json` denies agents reading `.env` themselves.

### Running it

It works in checkpoints and asks before writing anything. Read [context/README.md](context/README.md)
first if you want to know what it is aiming to produce.

Two things worth understanding before you run it:

- **It cannot see what you do not give it.** With only a URL and credentials it can still map modules,
  navigation and permissions by walking the application — that alone is most of the value. Everything
  else widens what it can establish.
- **Its "known unknowns" section is a deliverable, not a failure.** A gap recorded there makes the other
  agents ask you. A gap filled with a plausible guess makes them confidently wrong.

Skipping this step is allowed — write `PROJECT-PROFILE.md` and the flow plans by hand instead. It is the
same work, done without a first draft.

## 4. Review and finish the project profile

Open **`PROJECT-PROFILE.md`** and go through all eleven sections, correcting what step 3 drafted and filling
what it could not know.

The sections that matter most:

- **Section 2 (Roles)** — the planner uses this to decide which roles a story implicates. Name the baseline
  full-access role explicitly.
- **Section 3 (Domain vocabulary)** — the entities the planner is forbidden to write as literals. Anything
  missing here ends up hardcoded in a test.
- **Section 7 (Severity rubric)** — replace the examples with your own quality plan's wording. The healer
  classifies every confirmed defect against it.
- **Section 9 (Knowledge sources)** — what the agents can and cannot reach. Keep it honest.
- **Section 10 (Test strategy)** — which test types are in scope, and the entry and exit criteria a cycle is
  judged against. `npm run report:cycle` evaluates the exit criteria, so set thresholds your team will
  actually hold to.
- **Section 1's issue key format** — every story must arrive with its key (I8), and the agents validate
  against this. Also tighten `storyKeyPattern` in `config/projectProfile.ts` to match.

Then check `config/projectProfile.ts` matches sections 1, 2, 5 and 10.

## 5. Point the two shipped page objects at the real application

`pages/LoginPage.ts` and `pages/DashboardPage.ts` ship wired into the fixtures and the login helper, with
`CHANGE_ME` selectors. Replace those selectors with the real ones.

Prefer role- and label-based locators (`getByRole`, `getByLabel`) over XPath where the application gives
you the choice — they survive markup changes that a positional XPath does not.

Then verify the round trip — every role's login, and the first reference test:

```bash
npx playwright test tests/seeds/
npx playwright test tests/example.spec.ts --grep "@Priority1"
```

If you ran step 3, you already did the login half of this; run both anyway. Every seed passing means each
role can log in — and the agents, which start from those seeds, can work as each role. The first reference
test passing means login and the dashboard are wired correctly. That is the milestone worth stopping at —
everything after this builds on it.

## 6. Fill in test data

**`data/testData.ts`** — replace the `CHANGE_ME` keys with the entities from PROJECT-PROFILE.md section 3.
Keep the shape: a valid case, an unknown case, a malformed case, a terminal-state case. Those four cover
most of what the planner's partitioning and error-guessing scenarios ask for.

Fill in `boundaries` with the application's real limits — the planner's boundary scenarios read them.

`adversarialInput` is generic; leave it unless the application has its own known-bad inputs worth adding.

**`data/sql_queries.ts`** — replace the example keys. If step 3 wrote any `context/<area>.md` documents,
their Verification sections hold queries written to be lifted straight into this file. If DB validation is
out of scope, delete all but `healthCheck`.

Then:

```bash
npm run db:check
```

**Test data in a known state.** If the suite depends on seeded data, fill in `data/seed.ts` —
`resetTestData()` then `seedTestData()`, using `seed…` and `reset…` keys in `sql_queries.ts` — and set
`SEED_TEST_DATA=true`. It runs once before every run. Worth doing early: it is what lets tests stop depending
on whatever happens to be in the environment.

## 7. Review the navigation flows

Step 3 drafts `specs/UserFlowsUserRolePermissions/<role>NavigationFlow.plan.md` per role, plus the
cross-role permission matrix. Go through them.

Pay particular attention to the matrix: the agent marks each cell as verified or not tested, and does not
fill cells by symmetry. The "not tested" ones are yours to either confirm or leave honestly marked.

These are the highest-value documents in the repository. Both the planner and generator read them before
tracing a flow through `pages/` themselves, and the healer checks them before calling a blocked action a
defect. An empty set means all three re-derive navigation every run, and the healer will eventually report
a working permission boundary as a bug.

You do not need every flow documented before writing the first test — start with the baseline role's happy
path and grow it.

## 8. Review the module tags

Step 3 drafts the module table in `specs/RegressionTags/regression-tags.md` from what it found while
walking the application. Correct the names — these become the tags your team greps by, so they should read
the way your team talks.

The generator looks up a scenario's module here; anything unregistered makes it stop and ask.

## 9. Decide what to delete

- **No API tests?** Delete `lib/api/`, the `apiClient` fixture in `lib/BaseTest.ts`, and the `api` project
  in `playwright.config.ts`.
- **No database?** Delete `config/DbConnection.ts`, `config/db/`, `config/testDbConnection.ts`, the
  `db:check` script, the `mssql` and `pg` dependencies, and `expectGroupsMatchDatabase` in
  `DashboardPage.ts`.
- **One engine only?** Optional — the other driver is loaded only when used. To drop it, uninstall it
  (`mssql @types/mssql`, or `pg @types/pg`), delete its adapter in `config/db/`, and remove its entry from
  `ENGINES` in `config/DbConnection.ts`.
- **No tracker server?** Delete the `tracker` entry from `.mcp.json`. The agents fall back to pasted
  stories and the defect CSV; the `mcp__tracker__` rules in `.claude/settings.json` are then inert.
- **Only one browser?** Drop the `edge` project from `playwright.config.ts`.

## 10. Verify

Walk the checklist in PROJECT-PROFILE.md section 11, then:

```bash
npm run check                 # typecheck + docs consistency + traceability
npx playwright test tests/seeds/
npx playwright test tests/example.spec.ts
```

Before any run, `lib/globalSetup.ts` checks the application answers at `BASE_URL` — and the database, if in
scope. If the environment is down you get one clear "entry criteria not met" message instead of a report
full of failures that are nothing to do with the tests.

Once `example.spec.ts` passes end to end, the harness is wired. Keep it as a smoke check or delete it —
it is a reference, not coverage.

---

## Then: the first real test

1. Paste a story — **with its issue key** — into a conversation and run `/playwright-test-planner`. Work
   through its checkpoints; it will ask about scope, the invariants, and scenario titles before writing
   anything, and it will stop and ask if the key is missing.
2. Review `specs/<KEY>.plan.md`.
3. Run `/playwright-test-generator` against it. It drives the real browser first, then asks you to confirm
   the target file path, then writes the spec plus any page objects it needed.
4. Run the suite. If something fails, `/playwright-test-healer`. The cycle report for the stories that
   ran is written as soon as the run ends, in `reports/`.
5. For a release's regression, `npm run regression` — pick the release, then its tickets or epics. See
   `docs/WORKFLOWS.md` workflow 8.

## Keeping the knowledge current

`/playwright-context-builder` is **not** run for each story or testing task. It runs once here at setup;
from then on, day-to-day work is the planner → generator → suite → healer → defect-raiser loop, and those
agents read what it wrote.

Re-run it only when that knowledge goes stale:

- the application gains a module or a role
- a release changes navigation or permissions
- database access becomes available, having previously been absent
- the other agents keep asking for something about one area — its SQL, where a screen is — which means
  `context/` does not cover it

Name the area, module or role and it runs for that alone, leaving the rest of the baseline untouched. A
re-run is an update, not a fresh start: it reads the existing `context/BASELINE.md`, keeps what people
corrected, and shows differences before overwriting anything.

Usually the QA lead or the harness owner runs it, not every tester — it needs the test accounts, database
access, and someone present to answer its checkpoints.

When a test fails because a `context/` document no longer matches reality, fix the document in the same
change as the test. Context that has drifted is worse than no context, because an agent will act on it
confidently.

## Common setup problems

**`check:docs` says a file "contains a term from the originating project"** — the copy still has the
template's package name, so the template's neutrality check is running against your application's name.
Rename `name` in `package.json` (step 0).

**`.gitignore does not ignore .env`** — `.gitignore` was left out of a hand-made copy, or edited. Restore it
before committing anything.

**`Required environment variable BASE_URL is not set`** — `.env` missing or unpopulated. That error is
deliberate: the harness refuses to run against a default URL rather than silently test the wrong system.

**`Credentials for role 'x' are not configured`** — a role in `projectProfile.ts` has no
`<ROLE>_EMAIL`/`<ROLE>_PASSWORD` pair in `.env`. Add it, or remove the role from the `roles` array.

**`Database is not configured: DB_SERVER, ...`** — the `DB_*` block is missing from `.env`. Fill it, or set
`DB_VALIDATION_ENABLED=false`.

**Database unreachable** — `config/DbConnection.ts` prints what is wrong and what to do, including the
firewall rule to add when a server is refusing your IP. It latches that failure so the rest of the run
fails fast instead of spending a full connect timeout per test.

**The generator says `generator_setup_page` is unavailable** — the Playwright MCP server is not connected.
Fix that rather than letting it proceed; an agent that cannot drive the browser produces nothing usable.

**A seed in `tests/seeds/` fails** — the login itself is broken for that role: wrong selectors in
`pages/LoginPage.ts`, or a locked or expired account. Fix it before running an agent as that role; the agents
start from these files and will not work around them.

**`check:docs` says `tests/seeds/<role>.spec.ts is missing`** — a role was added to
`config/projectProfile.ts` without its seed. Copy another seed and change the role.

**The tracker server is listed but the agents cannot use it** — not signed in: run `/mcp`. If `?tools=all`
is missing from the `tracker` URL, the server offers only its generic `discover` and `execute` tools: it
still works, but every write asks with only the operation's name to go on — restore `?tools=all`.

**Every Jira tool appears twice** — both the `tracker` entry and the Atlassian plugin are connected. Keep one.

**A database or tracker tool is refused outright** — it is on the deny list in `.claude/settings.json`. That
is deliberate for writes; for a read tool your server names differently, add it to `allow`.

**An agent says a section is still a placeholder** — it found `<...>` in `PROJECT-PROFILE.md`. Fill that
section in; the agents refuse to invent your application's vocabulary, which is the point.

**An agent asks you for SQL you think it should know** — no `context/<area>.md` covers that area, and it
has no schema visibility. Either paste the query, or wire the database MCP server and run
`/playwright-context-builder` for that area.

# Setting the harness up for a new project

Work in order — later steps assume earlier ones.

The shape of it: get the harness talking to your application, let an agent explore it and draft what it
finds, then correct those drafts. Correcting a draft is much faster than writing one cold, which is why
step 3 comes before step 4.

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

No database? Set `DB_VALIDATION_ENABLED=false` and skip the `DB_*` block. No API? Leave
`API_TESTS_ENABLED=false`.

**MCP servers:**

```bash
cp .mcp.json.example .mcp.json
```

The Playwright entry is required — the generator and healer cannot work without a browser. The database
entry is optional but removes the single biggest source of friction in this harness: with it, agents can
read your schema instead of asking you for every query. Use a **read-only** account against a QA database,
never production. [docs/MCP.md](docs/MCP.md) has the reasoning and the caveats.

## 3. Baseline the application

```
/playwright-context-builder
```

This is the step that answers "how does a separate repository learn anything about my application". It
will:

- ask you what sources exist and which are reachable — the running app, the database, the source, API
  docs, contracts, who to ask about what
- log in as each role and walk the application, mapping modules, navigation paths and permission
  boundaries
- read whatever local sources you pointed it at, and introspect the database if one is wired
- write `context/BASELINE.md`, and draft `PROJECT-PROFILE.md` sections 2–4, the navigation-flow plans, and
  the module tag table

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

Open **`PROJECT-PROFILE.md`** and go through all nine sections, correcting what step 3 drafted and filling
what it could not know.

The sections that matter most:

- **Section 2 (Roles)** — the planner uses this to decide which roles a story implicates. Name the baseline
  full-access role explicitly.
- **Section 3 (Domain vocabulary)** — the entities the planner is forbidden to write as literals. Anything
  missing here ends up hardcoded in a test.
- **Section 7 (Severity rubric)** — replace the examples with your own quality plan's wording. The healer
  classifies every confirmed defect against it.
- **Section 9 (Knowledge sources)** — what the agents can and cannot reach. Keep it honest.

Then check `config/projectProfile.ts` matches sections 1, 2 and 5.

## 5. Point the two shipped page objects at the real application

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
- **No database?** Delete `config/DbConnection.ts`, `config/testDbConnection.ts`, the `db:check` script,
  the `mssql` dependencies, and `expectGroupsMatchDatabase` in `DashboardPage.ts`.
- **Only one browser?** Drop the `edge` project from `playwright.config.ts`.

## 10. Verify

Walk the checklist in PROJECT-PROFILE.md section 10, then:

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

## Keeping the knowledge current

Re-run `/playwright-context-builder` when the application gains a module or a role, when a release changes
navigation or permissions, or when database access becomes available having previously been absent.

When a test fails because a `context/` document no longer matches reality, fix the document in the same
change as the test. Context that has drifted is worse than no context, because an agent will act on it
confidently.

## Common setup problems

**`Required environment variable BASE_URL is not set`** — `.env` missing or unpopulated. That error is
deliberate: the harness refuses to run against a default URL rather than silently test the wrong system.

**`Credentials for role 'x' are not configured`** — a role in `projectProfile.ts` has no
`<ROLE>_EMAIL`/`<ROLE>_PASSWORD` pair in `.env`. Add it, or remove the role from the `roles` array.

**`Project profile not configured: ... still set to CHANGE_ME`** — `APP_NAME` or `TRACKER_PROJECT_KEY`
unset in `.env`.

**`Database is not configured: DB_SERVER, ...`** — the `DB_*` block is missing from `.env`. Fill it, or set
`DB_VALIDATION_ENABLED=false`.

**Database unreachable** — `config/DbConnection.ts` prints what is wrong and what to do, including the
firewall rule to add when a server is refusing your IP. It latches that failure so the rest of the run
fails fast instead of spending a full connect timeout per test.

**The generator says `generator_setup_page` is unavailable** — the Playwright MCP server is not connected.
Fix that rather than letting it proceed; an agent that cannot drive the browser produces nothing usable.

**An agent says a section is still a placeholder** — it found `<...>` in `PROJECT-PROFILE.md`. Fill that
section in; the agents refuse to invent your application's vocabulary, which is the point.

**An agent asks you for SQL you think it should know** — no `context/<area>.md` covers that area, and it
has no schema visibility. Either paste the query, or wire the database MCP server and run
`/playwright-context-builder` for that area.

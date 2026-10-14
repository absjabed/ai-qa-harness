# Workflows

End-to-end recipes. Each starts from a real situation and runs to a finished result.

---

## 1. First story on a freshly configured harness

**Before you start:** `npx playwright test tests/example.spec.ts` passes. If it doesn't, finish
[SETUP.md](../SETUP.md) — everything here assumes login and the dashboard are wired.

### Step 1 — Plan

With the tracker server wired, give the planner the story's key and it fetches the ticket itself, then
asks you to confirm what it read is complete. Without one, paste the story into the conversation — key,
title, description, acceptance criteria as plain text.

**The key is required** — the ticket's issue key, e.g. `PROJ-1234`. Without one the planner stops and asks;
it is the root of every TCID, test title and defect that follows (I8). It also records the story's client
release and epic — from Jira's fix version and parent epic, or by asking — which regression selects by.

```
/playwright-test-planner
```

Work its seven checkpoints. Two are worth real attention:

- **Checkpoint 1** — it echoes back the AC as it understood them, and flags ambiguity. Correct it here, not
  after 40 scenarios are written against a misreading.
- **Checkpoint 4** — scenario titles only. This is the cheapest redirect in the whole pipeline. Trimming
  here costs a sentence; trimming at checkpoint 6 means re-reviewing a full plan.

Out: `specs/<KEY>.plan.md` and `specs/<KEY>.plan.csv`.

### Step 2 — Read the plan's gap table

Before generating, look at the plan's "new page objects, fixtures and data keys required" table. Anything
listed there is something the generator will have to build. If a data key is listed, add it to
`data/testData.ts` yourself now — the generator flags data keys but doesn't author them.

### Step 3 — Generate

```
/playwright-test-generator
```

Point it at the plan file. It will drive the browser, then stop twice: once to confirm the target file path
(proposed from the plan's release and story key — or, with no release yet, its epic's folder), once for each
new page object it's about to create. Answer both.

Out: the spec, plus new page object methods and fixtures, implemented and wired.

### Step 4 — Run

```bash
npx playwright test "tests/stories/<release>/<KEY>.spec.ts"
```

When the run ends, the cycle report for that story is written to `reports/` — no separate step.

### Step 5 — Heal what fails

```
/playwright-test-healer
```

Three attempts per test. If it finds a genuine bug it stops and asks you to confirm severity.

### Step 6 — File confirmed defects

```
/playwright-defect-raiser
```

Only after the healer has recorded something. With the tracker server wired it shows the batch of bugs
and asks once before creating them — searching first, so a bug already filed for that TCID is reused rather
than duplicated. Without one it runs unattended and appends rows to `specs/defects.csv` for you to import;
fill each `trackerKey` in the defect log afterwards.

---

## 2. A test that passed last week now fails

Decide first whether the *application* changed or the *environment* did — they look identical from a red
test and have completely different fixes.

```bash
npm run db:check
```

DB unreachable → environment. Fix that before touching any test. The healer will tell you the same thing,
but this is faster.

Then:

```
/playwright-test-healer
```

Expect one of four outcomes:

| Outcome | What it means |
|---|---|
| Fixed in ≤3 attempts | Selector drift, timing, or an ambiguous locator |
| Stopped, asks to confirm a defect | Application behavior genuinely contradicts an expected-result line |
| Stopped, "cannot verify database state" | A DB-backed assertion it can't adjudicate — see below |
| Stopped after 3, summarizes suspicions | Doesn't meet the bug criteria and isn't an obvious test fix |

### The DB-backed case

The healer has no tool to query the database. When it stops here, you decide. Run the query it names by
hand against the environment:

- Query returns what the test expected → timing. The test asserted before the app finished persisting.
- Query returns something else, and that something else is wrong → application bug. Tell the healer to
  proceed with the defect workflow.
- Query returns something else, and it's stale data from a previous run → reseed, rerun.

---

## 3. Adding a page object by hand

Sometimes faster than a full generate — a small screen, or you already know the selectors.

1. **Create** `pages/<Name>Page.ts` extending `BasePage`. Locators as `readonly` properties, initialized in
   the constructor.
2. **Wire** into `lib/BaseTest.ts` — three edits: import, `Fixtures` field, `test.extend` factory. Name it
   camelCase of the class.
3. **Use** it by destructuring the fixture in a test.

```ts
export default class RecordListPage extends BasePage {
    readonly rows: Locator;
    readonly addButton: Locator;

    constructor(page: Page) {
        super(page);
        this.rows = page.getByRole('row');
        this.addButton = page.getByRole('button', { name: 'Add record' });
    }

    async openFirstRecord(): Promise<void> {
        // I7: rows matches many — scope before acting
        await this.firstOf(this.rows).click();
    }
}
```

The generator follows this exact shape, so a hand-written page object and a generated one are
indistinguishable in review — which is the point.

---

## 4. Adding a DB-backed assertion

1. Add the query to `data/sql_queries.ts` under the file's naming conventions.
2. Add a method to the relevant page object that runs it and compares:

```ts
async expectRecordStatusMatchesDatabase(identifier: string): Promise<void> {
    const db = new DbConnection();
    try {
        const result = await db.executeQuery(sqlQueries.getRecordByIdentifier(identifier));
        const fromDb = result.rows[0]?.Status;
        const fromUi = await this.statusBadge.innerText();
        expect(fromUi.trim()).toBe(String(fromDb));
    } finally {
        await db.close();
    }
}
```

3. Call it from the spec.

The `finally` matters — a connection left open holds a pool slot for the rest of the worker.

Never open a connection in a spec file. That's invariant I3, and it's also what lets the healer recognize a
DB-backed assertion and handle it differently.

---

## 5. Running a subset

```bash
npx playwright test --grep "@Regression"                          # full regression
npx playwright test --grep "@Priority1"                           # smoke equivalent
npx playwright test --grep "@RecordSearch"                        # one module
npx playwright test --grep "(?=.*@Regression)(?=.*@RecordSearch)" # module, regression only
npx playwright test --project=chromium                            # one browser
npx playwright test --project=api                                 # API only, no browser
```

**Watch for false positives.** `--grep` matches the full title string, not just real tags. A role or module
name written into a `test.describe` title will match even when the tests inside have nothing to do with it.
Tags belong in `{ tag: [...] }`. The Gotchas section of `specs/RegressionTags/regression-tags.md` lists the
ways this goes wrong in practice.

---

## 6. Onboarding someone new

Give them this order:

0. For a whole team at once, start with `docs/qa-harness-intro.html` — three slides on how their testing
   changes
1. `docs/index.html` — open in a browser, read the orientation and agent sections
2. `SETUP.md` — even if the harness is already configured, it explains why each piece exists
3. `TEST-AUTHORING-INVARIANTS.md` — eight rules, one page
4. `tests/example.spec.ts` — the conventions in working code
5. Their first task: add one page object by hand (workflow 3). Faster to understand the Page Factory by
   wiring one than by reading about it.

Skip the agents until after that. Someone who doesn't know the conventions can't review agent output, and
reviewing agent output is most of the job.

---

## 7. Starting a new project from the template

This repository is a template. You don't move a configured harness between projects, and you don't clone
the template for one — each project gets its own new QA repository, and the harness's files are copied into
it:

```bash
npm run export -- <path-to-the-new-repo>
```

Then follow [NEW-QA-REPO.md](NEW-QA-REPO.md): the files that are copied, the minimum to configure, the
checklist before the context-builder, and what it does.

### Feeding improvements back

Work on a real project is where the harness gets better — and also where it gets contaminated. The rule
that keeps it reusable:

| Goes back to the template | Stays in the project copy |
|---|---|
| A sharper agent prompt | Anything naming your application |
| A new `BasePage` helper | Your page objects, beyond the shipped three |
| A clearer error message | `testData.ts` / `sql_queries.ts` contents |
| A fix to `DbConnection` handling | Your navigation-flow plans, module tags, plans, specs |
| A new plan-template field | Your `PROJECT-PROFILE.md` answers |

The failure mode is gradual: one project-specific example in an agent prompt, one domain term in a doc,
and two projects later the template has a personality. Re-run a grep for your application's vocabulary
before merging anything upstream.

### Never copy back

`.env`, in either direction. New project, new credentials.

---

## 8. Regression for a release, and closing the cycle

Regression runs per **client release**, on a QA team member's own machine, against the build under test.
Each release has its tickets — the plans whose `**Release:**` names it — and you choose which of them to run.
The STLC's last phase depends on the TCIDs being intact end to end, which is why I8 exists.

1. **Retest anything reported fixed** (workflow 9) — a defect fixed in the tracker but still `fixme`'d here
   counts as blocked coverage.
2. **Run the regression:**

   ```bash
   npm run regression
   ```

   It asks, in turn:
   - **which release** — every release that has tickets is listed, newest last, the default — plus *no release
     yet* for stories not scheduled, `--release none` as a flag;
   - **which tickets** — all of them, those in chosen **epics**, or chosen tickets one by one;
   - **only tests tagged `@Regression`?** — yes by default; say no to run every test of those tickets.

   It shows the selection, asks once more, then runs it. With an agent, or to repeat a run, give the answers
   as flags instead — an agent asks you in the conversation and passes them:

   ```bash
   npm run regression -- --release 2.26 --epics PROJ-100 --yes
   npm run regression -- --release 2.26 --stories PROJ-12,PROJ-15 --all-tests --yes
   ```

   Tickets with no spec yet are kept in the report — their manual results, or *not executed*.
3. **The report is written as the run ends** — `reports/cycle-summary-release-<release>-<time>.md`, covering
   exactly the selection: each test case's outcome, pass rates by priority, acceptance-criteria coverage per
   story, open defects, traceability gaps, and each exit criterion from `PROJECT-PROFILE.md` section 10
   marked met or not.
4. **Record manual results** in `specs/execution/manual-results.csv` — every `Manual` case the planner
   seeded as `Not Run` — then rebuild the report by hand for the same scope:

   ```bash
   npm run report:cycle -- --release 2.26
   ```

5. **Decide.** The report states facts; closing the cycle is a person's call. A criterion missed knowingly —
   with a reason written down — is a legitimate outcome. One missed because nobody looked is not.

**The report after every run.** Any `playwright test` run — one spec, a whole folder — writes a cycle report
for the stories it ran, without being asked. `AUTO_CYCLE_REPORT=false` in `.env` turns that off.
`npm run report:cycle` is always there to build one by hand: for everything, `--release`, or `--stories`, and
`--strict` to exit non-zero when a criterion is unmet.

---

## 9. Retesting a fixed defect

A `test.fixme` is only correct while its bug is open. Once it is fixed, the skipped test is lost coverage.

1. Make sure each raised entry in `specs/temp-defects/defect-log.json` has its `trackerKey` — filled in for
   you in tracker mode, by hand after a CSV import.
2. Run the healer and ask it to retest raised defects — all of them, or one by TCID. With the tracker server
   wired it finds the fixed ones itself, from the bugs' status:

   ```
   /playwright-test-healer
   ```

3. For each, it un-`fixme`s the test and runs it twice. Passes both → active again, entry marked `verified`.
   Fails either → `fixme` restored exactly, entry stays `raised`, retest recorded — worth telling whoever
   marked the ticket fixed. With a tracker it offers, asking first, to comment the result on the bug and
   to move it: it lists the transitions your team's Jira workflow offers on that bug, and applies only the
   one you pick.

---

## 10. Putting test data into a known state

Tests that rely on whatever happens to be in the environment drift, cannot run in parallel, and fail in ways
the healer can only call "stale data".

1. Add `seed…` and `reset…` keys to `data/sql_queries.ts` — `context/<area>.md` recipes are the natural
   source. Make both idempotent.
2. Call them from `data/seed.ts`: `resetTestData()` first, then `seedTestData()`.
3. Set `SEED_TEST_DATA=true` in `.env`. `lib/globalSetup.ts` runs the pair once before every run.
4. For data a single test creates, use the `cleanup` fixture instead, so it is removed even when the test
   fails:

   ```ts
   test('PROJ-1234-TC006 Validate that a draft can be deleted', async ({ recordPage, cleanup }) => {
       const id = await recordPage.createDraft(recordData.newDraft);
       cleanup.add('delete draft', () => recordPage.delete(id));
       // ...
   });
   ```

---

## 11. Refreshing what the harness knows

`/playwright-context-builder` runs once at setup. It is not part of the per-story loop — workflow 1 never
calls it; the planner and generator read what it wrote.

Re-run it when:

- the application gains a module or a role
- a release changes navigation or permissions
- database access becomes available, having previously been absent
- the other agents keep asking about one area — its SQL, where a screen is — which means `context/` does
  not cover it

Steps:

1. Run `/playwright-context-builder` and name what changed — *"the Reports module is new"*, *"re-walk the
   read-only role after the permissions change"*. Named, it runs for that alone.
2. Answer its checkpoints. It reads the existing baseline and shows differences before overwriting anything
   a person corrected.
3. Review what it changed in `context/`, the navigation plans and the module tags, as you would any draft.

Small drift does not need the agent. When one test fails because a `context/` document no longer matches
the application, fix the document in the same change as the test.

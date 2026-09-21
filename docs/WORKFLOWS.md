# Workflows

End-to-end recipes. Each starts from a real situation and runs to a finished result.

---

## 1. First story on a freshly configured harness

**Before you start:** `npx playwright test tests/example.spec.ts` passes. If it doesn't, finish
[SETUP.md](../SETUP.md) — everything here assumes login and the dashboard are wired.

### Step 1 — Plan

Paste the story into the conversation. Key, title, description, acceptance criteria as plain text.

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

Point it at the plan file. It will drive the browser, then stop twice: once for the target file path
(release + story key), once for each new page object it's about to create. Answer both.

Out: the spec, plus new page object methods and fixtures, implemented and wired.

### Step 4 — Run

```bash
npx playwright test "tests/stories/<release>/<KEY>.spec.ts"
```

### Step 5 — Heal what fails

```
/playwright-test-healer
```

Three attempts per test. If it finds a genuine bug it stops and asks you to confirm severity.

### Step 6 — File confirmed defects

```
/playwright-defect-raiser
```

Only after the healer has recorded something. Runs unattended.

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
        const fromDb = result.recordset[0]?.Status;
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

1. `docs/index.html` — open in a browser, read the orientation and agent sections
2. `SETUP.md` — even if the harness is already configured, it explains why each piece exists
3. `TEST-AUTHORING-INVARIANTS.md` — seven rules, one page
4. `tests/example.spec.ts` — the conventions in working code
5. Their first task: add one page object by hand (workflow 3). Faster to understand the Page Factory by
   wiring one than by reading about it.

Skip the agents until after that. Someone who doesn't know the conventions can't review agent output, and
reviewing agent output is most of the job.

---

## 7. Starting a new project from the template

This repository is a template. You don't move a configured harness between projects — you take a fresh
copy of the template each time, which is always already at the pristine state.

```bash
gh repo create <org>/<app>-tests --private --template <org>/ai-qa-harness --clone
```

Or without git history, if the copy shouldn't be linked to the template at all:

```bash
git clone --depth 1 <template-url> <app>-tests && rm -rf <app>-tests/.git && git -C <app>-tests init
```

Then work through [SETUP.md](../SETUP.md).

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

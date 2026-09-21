# Agent Reference

Five agents in `.claude/commands/`. They form a pipeline but each runs alone.

`playwright-context-builder` runs first and rarely: it establishes what the harness knows about the
application, which the other four then read. See the handbook's **How it learns your application** section
for why a separate repository needs this at all.

```
story ──▶ planner ──▶ plan.md + plan.csv ──▶ generator ──▶ spec.ts + page objects
                                                                  │
                                                                  ▼
                                                            run the suite
                                                                  │
                                                            failing? ──▶ healer ──▶ fixed test
                                                                                      │
                                                                          genuine bug ▼
                                                                          defect-log.json
                                                                                      │
                                                                                      ▼
                                                                            defect-raiser
                                                                                      │
                                                                                      ▼
                                                                    defects.csv + test.fixme()
```

All five read `PROJECT-PROFILE.md` first. Three of them also read
`.claude/TEST-AUTHORING-INVARIANTS.md` and cite invariants by number rather than restating them — one file,
so a convention has a single place to change.

---

## What makes these different from asking an LLM to write tests

**The generator does not write from plan text.** It drives the real browser through the Playwright MCP
server first, reads back its own action log, and refuses to write a test for any step with no recorded
action. Plan text states intent; only the drive establishes what the DOM actually does.

**They stop and ask.** The planner has seven mandatory approval checkpoints. The generator blocks on the
target file path and on any new page object it is about to create. Neither invents a selector, a data key,
or a SQL query when it can't find one — it flags the gap.

**They refuse rather than guess.** A placeholder still in PROJECT-PROFILE.md stops the run. An
unregistered module tag stops the run. A missing SQL query stops the run. Every one of those is a point
where a guess would produce work that looks right and is wrong.

---

## `/playwright-test-planner`

Turns a story into a reviewed test plan.

| | |
|---|---|
| **Model** | opus, `effort: xhigh` |
| **Tools** | Glob, Grep, Read, LS, Write — read-only over the codebase, plus writing the plan |
| **Browser** | None. Grounds everything in the codebase. |
| **Input** | A story pasted into the conversation — key, title, description, AC. Optionally screenshots. |
| **Output** | `specs/<KEY>.plan.md` and `specs/<KEY>.plan.csv` |

### How to invoke

Paste the story into the conversation, then run the command. No tracker API — the story arrives as text.

Pasted screenshots are supplementary: used for field names, layout, labels, and states the text omitted.
It will not invent behavior a screenshot only implies without text or codebase confirmation.

### What it reads first

`PROJECT-PROFILE.md`, the invariants, then the per-role navigation plans for every role the story
implicates — which it infers from the story's own content rather than asking. Then `pages/`,
`lib/BaseTest.ts`, `data/*.ts`, and existing specs for near-duplicate coverage.

When the feature spans several pages or roles, it also reads
`specs/ScenarioGenerationPatterns/pageWiseAndRoleWiseCoverage.plan.md`.

### The seven checkpoints

It pauses at each, waits for explicit approval, and folds in corrections before continuing.

| # | It shows you | You give |
|---|---|---|
| 1 | Story key, title, AC, what screenshots added, flagged gaps | Approval or correction |
| 2 | Conventions it will follow (cited as I1–I7) | Approval |
| 3 | Existing page objects, fixtures, data keys it found | Approval or a scope cut |
| 4 | Proposed scenario **titles only** | Approval or a trim |
| 5 | Any new page object or fixture needed, and where it slots in | Approval |
| 6 | The complete markdown plan, in chat | Approval |
| 7 | The CSV rows | Approval |

Checkpoint 4 is the cheapest place to redirect — titles only, before any scenario is written out.

### How it assigns priority

Walks four questions in order, stopping at the first yes. This is ordered on purpose, so priority isn't
assigned by vibe:

1. Would a failure corrupt or lose data, or block a role from a core action with **no workaround**? → **P1**
2. Is this the **only** coverage for its AC — so cutting it leaves that AC untested? → **P1**
3. Does it replicate a covered P1 for a secondary role, or hit a secondary flow **with** a workaround? → **P2**
4. Otherwise — cosmetic, rare, low blast radius → **P3**

Ties round **toward P3**, not P1, unless skipping would leave a data-integrity or core-flow gap uncovered
elsewhere.

### The completeness critique

After drafting, it re-reads its own scenario set as a skeptic and asks: which implicated role has no
scenario; which page variant was skipped; which technique fits an AC but wasn't applied; which
cross-feature interaction was never asked about.

This is a different failure mode from the self-audit, which only catches gaps against ACs already named.
The critique targets what the first pass didn't think to cover.

### What to expect

- Scenarios tagged with the design technique used — EP, BVA, decision table, state transition, pairwise,
  error guessing.
- Every summary starting with the literal `Validate that`.
- An AC traceability table — every AC has a scenario, every scenario traces to an AC or a stated
  edge-case rationale.
- A "new page objects, fixtures and data keys required" table for anything it couldn't find.
- Expected Results specific enough for a zero-context reader: the exact page, section, wording, or state
  change — not a label.

### What it will not do

Invent a story key. Guess a selector for an element with no page object. Name a data key that doesn't
exist. Dictate which spec file a scenario lands in — that's the generator's blocking checkpoint.

---

## `/playwright-test-generator`

Turns an approved plan into a working spec, plus whatever page objects it needed.

| | |
|---|---|
| **Model** | opus |
| **Tools** | Glob, Grep, Read, LS, Edit, Write + the Playwright Test MCP browser and generator tools |
| **Browser** | **Required.** Drives the real application live. |
| **Input** | A plan from `specs/`, or an explicit scenario |
| **Output** | A spec file, plus new page object methods, new page objects, and new `lib/BaseTest.ts` fixtures |

### Requires the Playwright Test MCP server

Without it, the generator cannot run. This is not a soft dependency — its entire method rests on driving
the browser and reading back the log.

### The loop, per step

1. `generator_setup_page` — mandatory, even when the plan reads as descriptive enough to write code
   directly.
2. Drive the step live through `browser_*` tools. This drive is exploratory: it operates on the raw page to
   discover real behavior, and is **not** the shape the final code takes.
3. Map what it just did back to conventions — which page object method (I1), which fixture (I2), which data
   key (I3/I4). Scope any ambiguous locator now (I7), at the point the locator is written.
4. `generator_read_log` — confirm a real recorded action exists for every plan step. An empty or partial
   log means the drive didn't happen: it stops, re-runs setup, and does not write.

### Two blocking checkpoints

**Target file path.** It will not assume a path from the scenario name, even when one seems obvious. It
asks for release and story key, assembles the path per PROJECT-PROFILE.md section 8, and confirms the
folder exists — `generator_write_test` cannot create parent folders.

**New page objects.** Before implementing, it tells you which page object it's about to touch — "this page
already exists, I'm going to implement `addRecord` on `RecordListPage.ts`", or "no page object exists for
this feature yet, I'm going to create `RecordListPage.ts`" — and waits.

### What to expect in the output

- One test per file, inside a `test.describe` matching the plan's top-level item.
- `import test from '@lib/BaseTest'` and `expect` from `@playwright/test` — the shape every spec uses.
- Every plan step wrapped in its own `test.step('<step text>', ...)`.
- `test.beforeEach` calling `userLogin` for anything authenticated.
- Tags: `Priority 1` → `['@Regression', '@Priority1', '@Module']`; `Priority 2` → `@Priority2` variant;
  `Priority 3` → `['@Priority3', '@Module']` with no `@Regression`.
- Any new page object wired into `lib/BaseTest.ts` — implemented, not left as a flagged comment.

### What it will not do

Write a test for a step it never drove. Assume a file path. Invent a module tag — it asks, then writes the
row into `regression-tags.md` itself. Invent SQL. Write a role name into a `test.describe` title as a
substitute for a tag (`--grep` matches full title strings, which produces false positives).

---

## `/playwright-test-healer`

Diagnoses and fixes failing tests. Stops short of filing defects.

| | |
|---|---|
| **Model** | opus |
| **Tools** | Read/Edit/Write + Playwright MCP snapshot, console, network, `test_run`, `test_debug`, `test_list`, and `AskUserQuestion` |
| **Input** | A failing suite |
| **Output** | Fixed tests, or an entry in `specs/temp-defects/defect-log.json` |

### The three-attempt rule

Up to 3 fix attempts per test. Then one of three things happens:

- **Passes** → done.
- **High confidence it's a genuine application bug** → stops immediately, even mid-attempt, and runs the
  Defect Confirmation Workflow.
- **Still failing, bug criteria not met** → stops, summarizes what it tried and what it still suspects, and
  asks. It will not guess "bug" without meeting the criteria, and will not keep retrying past 3.

### What must be ruled out before calling something a bug

- A selector that changed and can be updated
- A timing issue fixable with a proper wait
- An ambiguous locator matching a different element than intended (I7)
- Stale test data or an incorrect assumption
- Flakiness — **reproduced at least twice**
- A documented permission boundary — it checks the navigation plans and cross-role matrix before calling a
  "Cannot do" restriction a defect

### Database-backed assertions: the known blind spot

DB queries run in the Node process, not the browser. None of the healer's tools can see what the database
actually contains.

So when a DB-backed assertion fails, it first looks for a code-level explanation — wrong column, mismatched
parameter, stale schema — and fixes that. It also distinguishes an unreachable database (an environment
fault, reported and stopped on, not "fixed" around) from a failed assertion.

If the query and comparison both look correct, it does **not** run the normal defect workflow — that
workflow expects browser evidence it has no equivalent of here. It stops and tells you which assertion
failed, the query involved, and that it cannot independently verify the database's state.

This is the one place the harness deliberately declines to reach a conclusion.

### Defect Confirmation Workflow

The single exception to "don't ask questions". It presents the test name, the violated expected-result
line, the observed behavior, the evidence ruling out a test-side cause, and a severity (P1–P4) classified
against PROJECT-PROFILE.md section 7 — judged by observed impact, **never** by the test's own `@PriorityN`
tag, which is test-coverage priority, not defect impact.

On your confirmation it appends to `specs/temp-defects/defect-log.json`. It does not write the CSV and does
not mark the test `fixme()`. The test stays red until the defect-raiser processes it.

### What to expect

It announces each diagnosis before editing, then edits without waiting — "selector for the Save button
changed from `#save-btn` to `[data-testid=save]`, updating the locator accordingly". Fixes stay inside the
conventions: a changed selector goes in the page object, not inlined into the spec; a changed expected
value goes in `testData.ts`, not typed into the test.

---

## `/playwright-defect-raiser`

The mechanical last step. Does not investigate or judge.

| | |
|---|---|
| **Model** | opus |
| **Tools** | Glob, Grep, Read, Edit, Write — no browser, no test runner |
| **Input** | `specs/temp-defects/defect-log.json` |
| **Output** | Rows in `specs/defects.csv`, plus tests marked `test.fixme()` |
| **Interactive** | No. Runs unattended. |

### Per pending entry

1. Map `entry.severity` to tracker Priority and Severity via PROJECT-PROFILE.md section 7. Default:
   P1→Highest/Critical, P2→High/Major, P3→Medium/Minor, P4→Low/Low.
2. Append a row to `specs/defects.csv`.
3. Open the spec, find the `test()` whose title matches exactly, change it to `test.fixme(`, and add a
   comment above referencing the defect and what the application does instead.
4. Set `status: "raised"` and add `raisedAt`.

### Safety behaviors

| Situation | What happens |
|---|---|
| Severity missing or not P1–P4 | Entry left `pending`, reported |
| `testName` not found in the spec (renamed or removed) | Entry left `pending`, reported — never guesses which test |
| A CSV row already exists for that `id` | Skipped, log status reconciled. Re-run safe. |
| Tracker key still a placeholder | Stops. A CSV of bugs filed under a placeholder key is worse than no CSV. |

It never alters the facts of a defect — summary, steps, actual/expected, evidence, severity all came from
the human-confirmed healer finding. Its only judgment is a table lookup.

---

## Practical notes

**Run them in order, but not necessarily in one sitting.** Each reads its input from disk. A plan reviewed
on Monday generates fine on Wednesday.

**The checkpoints are the value, not friction.** Checkpoint 4 (scenario titles) and the generator's file
path checkpoint are where a wrong assumption costs a sentence instead of an afternoon.

**When an agent stops and says something is a placeholder, that's it working.** The alternative is a test
suite built on invented vocabulary that passes review because it reads plausibly.

**The healer and generator need the Playwright Test MCP server.** The planner and defect-raiser don't.

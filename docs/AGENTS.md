# Agent Reference

Five agents, defined in [`agents/`](../agents/) as vendor-neutral markdown and wired into Claude Code by
thin wrappers in `.claude/commands/`. They form a pipeline but each runs alone.

Not using Claude Code? [`agents/README.md`](../agents/README.md) covers porting — it is a one-line wrapper
per agent, plus frontmatter translation.

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
`TEST-AUTHORING-INVARIANTS.md` and cite invariants by number rather than restating them — one file,
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

## `/playwright-context-builder`

Establishes what the harness knows about the application. **Not a per-story agent**: it runs once at
setup, and again only when the application gains a module or a role, changes navigation or permissions,
database access first becomes available, or the other agents keep asking about an area `context/` does not
cover. Name an area, module or role to run it for that alone. Usually the QA lead runs it, not every tester.

| | |
|---|---|
| **Model** | opus, `effort: xhigh` |
| **Tools** | Read, search and write over the repo; the Playwright browser tools; the database's read tools, if wired |
| **Browser** | Required. It walks the application as each role, read-only, starting from each role's seed in `tests/seeds/`. |
| **Input** | Answers to its inventory questions; documents in `context/sources/`; the Jira epics or releases to digest, if connected |
| **Output** | `context/BASELINE.md`, `context/<area>.md`, drafts of PROJECT-PROFILE §2–4, navigation plans, module tags |

### Before you run it

- **Must have:** the application reachable from where the agent runs; `BASE_URL` and a credential pair per
  role in `.env`; the role keys in `config/projectProfile.ts` and PROJECT-PROFILE §2, with the baseline role
  named; one login seed per role; the Playwright MCP server connected. Its preflight runs the logins itself,
  and offers to fill the login selectors if they are still `CHANGE_ME`.
- **It never sees a password.** Each seed logs in inside the test runner, and `.claude/settings.json`
  denies agents reading `.env`. Still use dedicated QA test accounts.
- **Worth gathering:** the project's existing knowledge — functional specs, business-rule documents,
  existing test cases and bug history exported into `context/sources/`, and the Jira epics or releases to
  digest; a read-only database account; local paths to source, API docs, schema scripts and contracts; who
  to ask about what.
- **Decide:** which environment (never production), what it should stay out of, and that you will be there
  to answer its checkpoints.

The full checklist is in `docs/NEW-QA-REPO.md` section 4.

### How it gathers

Preflight — it runs every role's login seed and reports per role what passed and what to fix, and confirms
the Jira connection by fetching one known story → inventory what is reachable → **roam**: the signed-out
pages (login screen, password reset, public pages), then each role page to page, read-only → read what you brought — specs, business rules, existing test cases, bug history, the Jira epics you named, source and API docs → introspect
the database, if wired → distil into the documents above, each with its provenance and date. It checkpoints
after the preflight, after the inventory and after the roam.

### What it will not do

- Write anything to the application or the database — no forms, no records, no settings.
- Infer a business rule from a screen label, or fill a permission cell by symmetry.
- State a database constraint it has not confirmed against real rows.
- Overwrite what a person corrected without showing the difference first.

Its **known unknowns** section is a deliverable. A recorded gap makes the other agents ask; a plausible
guess makes them confidently wrong.

---

## `/playwright-test-planner`

Turns a story into a reviewed test plan.

| | |
|---|---|
| **Model** | opus, `effort: xhigh` |
| **Tools** | Glob, Grep, Read, LS, Write — read-only over the codebase, plus writing the plan; the tracker's read tools, if wired |
| **Browser** | None. Grounds everything in the codebase. |
| **Input** | A story key. With the tracker server wired it fetches the story itself; otherwise paste key, title, description and AC. Optionally screenshots. |
| **Output** | `specs/<KEY>.plan.md` and `specs/<KEY>.plan.csv` |

### How to invoke

Run the command with the story's key. With the tracker server wired, the planner fetches the ticket and asks you to confirm it is complete; without one, paste the story into the conversation as text.

Each plan also records the story's **release** — the client release it ships in — and its **epic**, if any:
from Jira's fix version and parent epic when connected, otherwise asked at the first checkpoint.
`npm run regression` selects by them. The release is the project's own, never the harness's version.

**The story's issue key is mandatory** — the ticket's ID in the tracker, a Jira key for example. Without one
the planner stops and asks, before doing anything else; with one that doesn't match the format in
`PROJECT-PROFILE.md` section 1, it asks you to confirm. There is no key-less mode, because every TCID,
test title and defect downstream is built on that key (I8).

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
| 2 | Conventions it will follow (cited as I1–I8) | Approval |
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

### It owns the TCIDs

The planner is the only agent that assigns test case IDs: `<STORY-KEY>-TC<NNN>`, sequential from `001`.
They are immutable once saved. Revising a plan keeps every existing TCID, gives new scenarios the next unused
numbers, and marks dropped ones `Retired` rather than deleting them — so a number is never reused for a
different test, and every result and defect recorded against it stays meaningful.

On saving, it also seeds a `Not Run` row in `specs/execution/manual-results.csv` for every `Manual`
scenario, so manual cases are counted at cycle closure rather than forgotten.

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
| **Starts from** | The scenario's role seed, `tests/seeds/<role>.spec.ts` — or `tests/seed.spec.ts` for a signed-out scenario. It always names the seed; it never logs in by hand or reads `.env`. |
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
proposes one from the plan's `**Release:**` and story key — asking for the release only if the plan has none
— assembles it per PROJECT-PROFILE.md section 8, has you confirm it, and checks the folder exists —
`generator_write_test` cannot create parent folders.

**New page objects.** Before implementing, it tells you which page object it's about to touch — "this page
already exists, I'm going to implement `addRecord` on `RecordListPage.ts`", or "no page object exists for
this feature yet, I'm going to create `RecordListPage.ts`" — and waits.

### What to expect in the output

- **The title is the TCID followed by the plan's summary, verbatim:**
  `test('PROJ-1234-TC004 Validate that an expired reset link is rejected', ...)`. That prefix is what traces
  a failing test back to its plan row and its acceptance criterion (I8).
- One test per TCID, in `tests/stories/<release>/<STORY-KEY>.spec.ts` — the file named for the story, holding
  only that story's TCIDs, inside a `test.describe` matching the plan's module.
- `import test from '@lib/BaseTest'` and `expect` from `@playwright/test` — the shape every spec uses.
- Every plan step wrapped in its own `test.step('<step text>', ...)`.
- `test.beforeEach` calling `userLogin` for anything authenticated.
- Tags: `Priority 1` → `['@Regression', '@Priority1', '@Module']`; `Priority 2` → `@Priority2` variant;
  `Priority 3` → `['@Priority3', '@Module']` with no `@Regression`.
- Any new page object wired into `lib/BaseTest.ts` — implemented, not left as a flagged comment.

### What it will not do

Mint a TCID — if a scenario has no plan row, it asks you to add one (or run the planner) instead. Write a
test for a step it never drove. Assume a file path. Invent a module tag — it asks, then writes the
row into `regression-tags.md` itself. Invent SQL. Write a role name into a `test.describe` title as a
substitute for a tag (`--grep` matches full title strings, which produces false positives).

---

## `/playwright-test-healer`

Diagnoses and fixes failing tests. Stops short of filing defects.

| | |
|---|---|
| **Model** | opus |
| **Tools** | Read/Edit/Write + Playwright MCP snapshot, console, network, `test_run`, `test_debug`, `test_list`, and `AskUserQuestion`; the database's and tracker's read tools, if wired |
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

### Database-backed assertions — it depends on access

DB queries run in the Node process, not the browser, so no browser tool can see what the database holds.
Either way it first looks for a code-level explanation — wrong column, mismatched parameter, stale schema —
and treats an unreachable database as an environment fault, reported and stopped on, never "fixed" around.

**With a read-only database MCP server wired**, it re-runs the assertion's own query, `SELECT` only:

| What it finds | Conclusion |
|---|---|
| The value is now what the test expected | Timing — fix with a wait, not a defect |
| Wrong, and contradicts an invariant in `context/` | Strong evidence of a real bug → defect workflow |
| Wrong, and nothing documents what it should be | Unresolved — reports both values |
| The row is missing | Usually stale or unseeded data — asks about reseeding |

**Without one**, it declines to guess: it cannot tell an application bug from stale data or a timing
problem, so it stops and reports which assertion failed and the query involved. This is the one place the
harness deliberately declines to reach a conclusion.

Its database access is read-only twice over: a read-only account, and `.claude/settings.json` denying the
database server's write tools.

### It never changes a TCID

A fix may reword a title's summary if the plan's wording changed; the `<STORY-KEY>-TC<NNN>` prefix stays
exactly as it was. Renaming it would silently orphan every result and defect recorded against it. A failing
test whose title has no TCID is reported as a suite defect, not logged as an application one.

### Retesting a fixed defect

With the tracker server wired it finds what to retest itself — the `raised` defects whose bugs the tracker
shows as done — and says which it found. Without one, tell it which were fixed. Then it switches each
`test.fixme(` back to `test(`, runs it twice, and:

- **passes both times** → keeps it active, removes the defect comment, marks the log entry `verified`
- **fails either time** → restores the `fixme` exactly, leaves the entry `raised`, records the retest

With a tracker, it offers to record the result on the bug — asking first: a comment, and a status change.
The statuses come from your team's own Jira workflow: it lists the transitions that bug currently offers and
asks which one, if any, to apply. It never picks one itself, and edits nothing else on the bug.

Without this step a `fixme`'d test stays skipped forever, long after its bug was fixed, and the suite quietly
loses coverage.

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
| **Tools** | Glob, Grep, Read, Edit, Write — no browser, no test runner; the tracker's search, create and link tools, if wired |
| **Input** | `specs/temp-defects/defect-log.json` |
| **Output** | Bugs in the tracker, or rows in `specs/defects.csv` — plus tests marked `test.fixme()` |
| **Interactive** | Without a tracker, no — runs unattended. With one, it asks once before creating anything. |

### Two modes

| | Tracker mode — server wired | CSV mode — no server |
|---|---|---|
| Files the bug | Creates it in the tracker, linked to the story | Appends a row to `specs/defects.csv` for someone to import |
| Duplicates | Searches for an open bug labelled with the TCID first; reuses it if found | One row per log `id`; a re-run skips existing rows |
| Asks | Once, showing the whole batch before creating any of it | Nothing |
| `trackerKey` | Filled in for you | Fill it in after the import |
| `fixme` comment | References the tracker key | References the log `id` |

It never writes a CSV row for a bug it created — importing the CSV would then file it twice — and it never
edits, moves or comments on an existing issue.

### Traceability it adds

Every bug it files carries the story key and TCID — in the labels, and in a *Traceability* line in the
description — so anyone reading the tracker can walk back to the test case and the acceptance criterion it
verifies. An entry that can't be traced to a TCID is left `pending` and reported rather than filed.

### Per pending entry

1. Map `entry.severity` to tracker Priority and Severity via PROJECT-PROFILE.md section 7. Default:
   P1→Highest/Critical, P2→High/Major, P3→Medium/Minor, P4→Low/Low.
2. Build the bug — the same summary, description and labels in either mode.
3. File it: create it in the tracker after the batch confirmation, or append the CSV row.
4. Open the spec, find the `test()` whose title matches exactly, change it to `test.fixme(`, and add a
   comment above referencing the defect and what the application does instead.
5. Set `status: "raised"` and add `raisedAt`.

### Safety behaviors

| Situation | What happens |
|---|---|
| Severity missing or not P1–P4 | Entry left `pending`, reported |
| `testName` not found in the spec (renamed or removed) | Entry left `pending`, reported — never guesses which test |
| A CSV row or tracker bug already exists for it | Skipped, log status reconciled. Re-run safe. |
| A tracker create fails mid-batch | Stops and reports what was and was not created — the duplicate check makes the re-run safe |
| Tracker key still a placeholder | Stops. A bug filed under a placeholder key is worse than none. |

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

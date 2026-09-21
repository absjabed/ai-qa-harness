# `<STORY-KEY>` — `<Story Title>` Test Plan

> Template for `playwright-test-planner` output. The agent writes
> `specs/<STORY-KEY>.plan.md` and `specs/<STORY-KEY>.plan.csv` from this shape. Copy it if writing a
> plan by hand; delete this blockquote.

## Story

**Key:** `<STORY-KEY>` (verbatim from the ticket — never invented)
**Title:** `<Story title>`

**Acceptance Criteria:**
- **AC1** — `<...>`
- **AC2** — `<...>`

## Scope Notes

`<Prose for anything that does not fit a per-scenario field: ambiguity found in the AC and how it
was resolved, near-duplicate coverage already present elsewhere, scenarios deliberately not
replicated across pages and why (see ScenarioGenerationPatterns §5), and anything descoped. The CSV's
Comment column mirrors this prose rather than introducing new information.>`

## New page objects, fixtures and data keys required

Anything the plan implies that has no home in the codebase yet. Flagged rather than guessed — the
generator agent implements these, and a made-up name here becomes a wrong name there.

| What | Where it slots in | Needed by |
|---|---|---|
| `<methodName()>` | `pages/<Name>Page.ts` | TC00N |
| `<fixtureName>` | `lib/BaseTest.ts` | TC00N |
| `<dataKey>` | `data/testData.ts` | TC00N |

## AC traceability

Every AC has at least one scenario; every scenario traces back to an AC or to a stated
edge-case/error-guessing rationale. No orphans in either direction.

| AC | Scenarios |
|---|---|
| AC1 | TC001, TC004 |
| AC2 | TC002 |
| _Error guessing_ | TC005 |

---

## Module: `<Module>`

### `<STORY-KEY>`-TC001 — Validate that `<descriptive title>`

**Test Type:** Automated
**Story:** `<STORY-KEY>`
**Module:** `<Module>`
**Sub Module:** `<Specific flow>`
**Technique:** `<EP | BVA | Decision Table | State Transition | Pairwise | Error Guessing>`
**Test Steps:**
Given `<the starting application/DB state this scenario assumes, sourced from data/*.ts or
sql_queries.ts — not a silent fresh-state guess>`
And `<additional precondition>`
When `<the action under test, plain English first>` (`<fixture>.<method>()`)
Then `<brief in-flow check that the action landed>` (`<fixture>.<method>()`)

**Expected Result:** `<The fuller pass/fail statement — what is visible or true, where, with the
exact wording, state, or value shown. Specific enough for a zero-context reader to verify without a
follow-up question. Only the outcome: no Priority, Test Type, or Status leaking in here.>`
**Data:** `<dataKey from data/testData.ts>`
**Priority:** `<Priority 1 | Priority 2 | Priority 3>`

### `<STORY-KEY>`-TC002 — Validate that `<descriptive title>`

**Test Type:** Automated
**Story:** `<STORY-KEY>`
**Module:** `<Module>`
**Sub Module:** `<Specific flow>`
**Technique:** `<...>`
**Test Steps:**
Given `<...>`
When `<...>`
Then `<...>`

**Expected Result:** `<...>`
**Data:** `<...>`
**Priority:** `<...>`

---

## Field rules

Kept here so a hand-written plan matches a generated one.

- **Summary** always starts with the literal `Validate that`, and is merged into the `###` heading
  rather than repeated as a field below it.
- **One field per line**, each with its own `**Label:**`. Never pipe-joined onto a shared line.
- **Test Steps** are Given/When/Then, one clause per line, unnumbered. Plain-English action first;
  the fixture/page-object method trails in parens. Never a bare method call as the clause text.
- **Expected Result** is distinct from the trailing `Then` clause. `Then` is a brief in-flow check;
  Expected Result is the detailed pass/fail statement. Never omit it because a `Then` exists.
- **Field isolation**: Test Type, Story, Priority, and Status live only in their own fields.
- **Markdown plan omits** `Status`, `Bug ID`, `Bug Status`, `Severity`, `Comment` — those are
  CSV-only columns.

# Test Authoring Invariants (I1–I8)

The single source of truth for how tests in this repo are written. `playwright-test-planner`,
`playwright-test-generator`, and `playwright-test-healer` all read this file and reference these by
number — they never restate them, so there is exactly one place a convention can change.

Application-specific names come from `PROJECT-PROFILE.md`, never from this file.

---

**I1 — Page Object Model.**
Every UI interaction maps to a method on a page object in `pages/` (shared widgets in
`pages/common/`, shared behavior on `pages/BasePage.ts`). Never an inline raw locator
(`page.click(...)`, `page.getByRole(...)`) in a spec file.

No existing method for an action → check whether a page object for that feature already exists. If
it does, add the method there, matching the file's conventions. If none exists, create a new file
following the structure of a comparable one. Wire any brand-new page object into `lib/BaseTest.ts`
as a fixture (I2) rather than leaving it unreachable. Implementing is the default; flagging a gap in
a comment is only for when ownership between two existing page objects is genuinely ambiguous.

Locators are declared as `readonly ...: Locator` class properties, initialized once in the
constructor, referenced as `this.<name>` inside methods — never a fresh `page.locator(...)` written
inline in a method body.

**I2 — Page Factory fixtures.**
Import `test` as the default export from `@lib/BaseTest` (`import test from '@lib/BaseTest';`) and
`expect` separately from `@playwright/test`. This is the import shape every spec uses — never
`import { test, expect } from '@lib/BaseTest'`.

Destructure only the fixtures the scenario needs. Check `lib/BaseTest.ts` for the exact names in
use. Never `new SomePage(page)` ad hoc. A step that is genuinely page-object-agnostic (asserting a
bare URL after an unauthenticated `page.goto`, say) may use the raw `page` fixture — the exception,
not the default.

**I3 — Centralized test data.**
No literal business identifier, name, code, or other domain value in a test or plan — reference a
key from `data/testData.ts`. The terms this covers are listed in `PROJECT-PROFILE.md` section 3. No
matching key yet → flag it; never invent a literal.

The same applies to DB-backed validation: reference a `sqlQueries.<key>` from `data/sql_queries.ts`,
executed via `config/DbConnection.ts` **inside a page object method** (I1) — never inline SQL or a
raw DB call in a spec file.

No matching query key yet → look in `context/<area>.md` first: a context document's "Verification"
section holds queries written to be lifted straight into `data/sql_queries.ts`, and using one is
preferred over asking. If no context document covers the area, do not write the SQL yourself — without
schema visibility a query you invent will look plausible and be wrong. Ask for the query text, then add
it under that file's naming and formatting conventions.

**I4 — Credentials.**
Only `testUsers.<role>` / `defaultUsers.<role>` from `@data/auth_data`, driven through the
`userLogin` helper (`pages/common/login.ts`) in a `test.beforeEach`. Role keys are listed in
`PROJECT-PROFILE.md` section 2. Never a literal email or password, not even as an example — the
values themselves live in `.env`, and nothing in the repo should be able to leak them.
Agents never read `.env` at all: one that needs to be logged in starts from its role's seed,
`tests/seeds/<role>.spec.ts`, which logs in inside the test runner and hands over a signed-in page.

**I5 — No hardcoded assertion values.**
Counts, statuses, dates, and list contents that vary by environment or seed data are asserted via
pattern, set-membership, or a before/after comparison against a runtime-obtained value — never a
number or string copied out of a manual exploration run.

**I6 — Environment-driven config.**
URLs and DB settings come from `.env` via `@config/testConfig` (`appConfig`). Never a literal
environment URL, hostname, or DB credential anywhere in the repo.

**I7 — Locator uniqueness.**
Before writing an interaction or assertion on a locator, check whether it could match more than one
element — a repeated list row, a repeated card, a class shared across siblings. If so, scope it to a
single match (`.first()`, a more specific parent/child chain, or a unique attribute) rather than
leaving it ambiguous.

An ambiguous locator that happens to work during a live exploratory drive is exactly what produces a
flaky test weeks later. Scope it at authoring time, not after a healer pass finds it.

**I8 — Traceability.**
Every test case belongs to a ticket, and its identity survives every step from plan to defect.

- **The story key is mandatory.** It is the ticket's issue key (a Jira key, for example), in the format set
  in `PROJECT-PROFILE.md` section 1. No story key → ask for it explicitly and wait. Never invent one, never
  plan against a placeholder, never fall back to a feature name.
- **TCIDs are `<STORY-KEY>-TC<NNN>`** — the story key, then `TC` and a three-digit number, e.g.
  `PROJ-1234-TC004`. Numbered sequentially within the story from `001`.
- **TCIDs are assigned only in the plan** (`specs/<STORY-KEY>.plan.md`). Nothing else mints one.
- **TCIDs are immutable.** Never renumber, never reuse. A case that is dropped keeps its ID and is marked
  `Retired` in the plan; the number is not handed to anything else. A case added later takes the next unused
  number.
- **Every automated test title starts with its TCID**, then the summary from the plan:
  `test('PROJ-1234-TC004 Validate that an expired reset link is rejected', ...)`. One TCID, one test. A test
  lives in `tests/stories/<release>/<STORY-KEY>.spec.ts`, and every TCID in that file belongs to that story.
  Module-wise specs that predate any plan (`tests/<module>.spec.ts`) may carry none; they are reported as
  untraced rather than rejected — and are invisible to acceptance-criteria coverage until they gain one.
- **A fix never changes a TCID.** A healer edit may reword a title's summary; the TCID prefix stays exactly
  as it was.
- **Defects carry the TCID and the story key**, so a failing test leads back through its test case to the
  acceptance criterion it breaks.

`npm run check:trace` enforces the mechanical parts of this: well-formed and unique TCIDs, every story test
titled with one, every one present in its story's plan.

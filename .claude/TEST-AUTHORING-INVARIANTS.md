# Test Authoring Invariants (I1–I7)

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
raw DB call in a spec file. No matching query key yet → do not write the SQL yourself; you have no
schema visibility to get it right. Ask for the query text, then add it to `data/sql_queries.ts`
following that file's naming and formatting conventions.

**I4 — Credentials.**
Only `testUsers.<role>` / `defaultUsers.<role>` from `@data/auth_data`, driven through the
`userLogin` helper (`pages/common/login.ts`) in a `test.beforeEach`. Role keys are listed in
`PROJECT-PROFILE.md` section 2. Never a literal email or password, not even as an example — the
values themselves live in `.env`, and nothing in the repo should be able to leak them.

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

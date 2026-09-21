# Regression & Module Tags

The registry of Playwright `{ tag: [...] }` values used across the suite, so runs can be filtered by
module and/or regression status. The `playwright-test-generator` agent reads this file to pick a
scenario's module tag, and writes new rows into it when you approve a new module name.

Fill the table in section "Module tags" from PROJECT-PROFILE.md section 4.

## Convention

- Every regression-worthy test gets `@Regression` plus a `@PriorityN` tag plus one module tag.
- Priority tags map from the plan's `Priority` field:
  - `Priority 1` → `['@Regression', '@Priority1', '@<Module>']`
  - `Priority 2` → `['@Regression', '@Priority2', '@<Module>']`
  - `Priority 3` → `['@Priority3', '@<Module>']` — no `@Regression`
- Module tag names are PascalCase, no spaces or slashes (`@RecordSearch`, not `@Record Search`) so
  they stay simple to grep without quoting.
- Module-wise spec files (`tests/<module>.spec.ts`): tag once at the top-level `test.describe(...)`;
  nested describes inherit it.
- Story-wise spec files (`tests/Release wise test cases/**/*.spec.ts`): tests from several modules
  share one file, so tag per-test — and only after checking what the test body actually does.

## Running

```bash
npx playwright test --grep "@ModuleTag"                             # one module
npx playwright test --grep "@Regression"                            # full regression
npx playwright test --grep "(?=.*@Regression)(?=.*@ModuleTag)"      # one module, regression only
npx playwright test --grep "@Priority1"                             # smoke-equivalent
```

## For the test-generator agent

After applying the Priority tag, look up the scenario's plan `Sub Module` (falling back to `Module`
if there is no closer match) against the table below. Match on meaning, not exact string equality —
plan wording will not always match a tag name verbatim. If a module has no tag yet, do not invent
one: tell the user the module is unregistered and ask what to call it, then add the row here once
they confirm.

## Gotchas

These bit the suite this harness came from. They generalize.

- A role or module name written inside a `test.describe` **title string** is not a Playwright tag.
  `--grep` matches against the full title, so `test.describe('@Admin Story-1234 ...')` shows up as a
  false positive for `--grep "@Admin"` even when the tests inside have nothing to do with Admin.
  Put tags in `{ tag: [...] }`, not in titles.
- A data key containing a module's name does not mean the test exercises that module. A spec
  referencing `recordData.searchIdentifier` may contain zero search tests. Read the body.
- Two tests with near-identical titles can drive different pages through different page objects —
  check which fixture and method a test actually calls before tagging it by its name.
- Placeholder/stub specs with empty bodies stay untagged, so they never inflate a regression count.

## Module tags

One row per module in PROJECT-PROFILE.md section 4.

| Module | Spec file(s) | Module tag |
|---|---|---|
| `<Module A>` | `tests/<moduleA>.spec.ts` | `@<ModuleA>` |
| `<Module B>` | `tests/<moduleB>.spec.ts` | `@<ModuleB>` |

## Story-wise files — module tagging status

Track which story files have had module tags applied, so a partially-tagged suite is visible rather
than silently under-reporting on a `--grep` run.

| File | Module tagging status |
|---|---|
| _(none yet)_ | — |

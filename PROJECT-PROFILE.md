# Project Profile

**This is the one file you fill in per project.** Every agent in `agents/` reads it before
doing anything, and `config/projectProfile.ts` mirrors the machine-readable parts for the TypeScript side.
Nothing else in this harness should need to know your application's name, vocabulary, or roles.

Replace every `<...>` placeholder. Delete rows that don't apply. Do not delete section headings — the agents
look them up by name.

---

## 1. Application

| Field | Value |
|---|---|
| Application name | `<AppName>` |
| One-line description | `<what the app does, in one sentence — agents use this to judge risk>` |
| Domain | `<e.g. billing / logistics / CRM / field service>` |
| Primary environment under test | `<QA / UAT>` |
| Base URL | Read from `BASE_URL` in `.env` — never written literally anywhere |
| Issue tracker project key | `<e.g. PROJ>` |
| Issue key format | `<e.g. PROJ-1234>` — **required on every story.** Agents validate story keys against it and ask when one is missing (I8) |
| Template version this copy started from | `<e.g. 1.0.0>` — see the template's CHANGELOG |
| Template commit this copy started from | `<short sha>` — from `git rev-parse --short HEAD`, run right after cloning |

## 2. Roles

The agents use this table to decide which roles a story implicates, which permission boundaries to test, and
which navigation-flow plan to read. One row per role that can log in.

| Role key | Display name | Credential key in `data/auth_data.ts` | Scope of authority | Navigation plan |
|---|---|---|---|---|
| `<admin>` | `<Administrator>` | `testUsers.<admin>` | `<full system configuration>` | `specs/UserFlowsUserRolePermissions/<admin>NavigationFlow.plan.md` |
| `<standardUser>` | `<...>` | `testUsers.<standardUser>` | `<...>` | `specs/UserFlowsUserRolePermissions/<standardUser>NavigationFlow.plan.md` |
| `<readOnlyUser>` | `<...>` | `testUsers.<readOnlyUser>` | `<view-only>` | `specs/UserFlowsUserRolePermissions/<readOnlyUser>NavigationFlow.plan.md` |

**Baseline role** (the full-access role every other role's restrictions are defined against): `<role key>`

Each role also needs a login seed, `tests/seeds/<role key>.spec.ts` — copy an existing one and change the
role. Agents start from it whenever they need to be logged in, so they never handle a password.
`npm run check:docs` fails if a role has no seed.

## 3. Domain vocabulary

The agents use this to recognize a domain entity in a story, and to refuse to inline it as a literal (I3).
Every term listed here must live in `data/` as a key, never typed directly into a spec or plan.

| Term | Meaning | Where its test data lives |
|---|---|---|
| `<Record>` | `<the core entity the app manages>` | `data/testData.ts` → `<recordData>` |
| `<Identifier>` | `<its unique business identifier, e.g. account no.>` | `data/testData.ts` → `<recordData.identifier>` |
| `<Owner>` | `<the person/entity a record is assigned to>` | `data/testData.ts` → `<ownerData>` |
| `<Grouping>` | `<the organizational unit records are filed under>` | `data/testData.ts` → `<groupData>` |

**Sensitive-value rule:** any value in this table is treated as test data, never a literal in a test, plan,
CSV, or agent output.

## 4. Modules

Feature areas of the application. Drives the `Module` / `Sub Module` plan fields and the module tags in
`specs/RegressionTags/regression-tags.md`.

| Module | Sub modules | Regression tag |
|---|---|---|
| `<Module A>` | `<flow 1>, <flow 2>` | `@<ModuleA>` |
| `<Module B>` | `<flow 1>` | `@<ModuleB>` |

## 5. Data layer

| Field | Value |
|---|---|
| Database engine | `<SQL Server / PostgreSQL>` — set `DB_ENGINE` in `.env` to `mssql` or `postgres`; `config/DbConnection.ts` supports both |
| DB validation in scope? | `<yes / no>` — if no, agents skip all DB-backed assertion guidance |
| Schema owner/prefix | `<e.g. dbo on SQL Server, public on PostgreSQL>` |
| Smoke-test query | Set `DB_SMOKE_QUERY` in `.env`; `npm run db:check` runs it |

## 6. API layer

| Field | Value |
|---|---|
| API tests in scope? | `<yes / no>` — if no, delete `lib/api/` and the `api` project in `playwright.config.ts` |
| Auth scheme | `<Basic / Bearer / none>` |
| Base URL env var | `API_BASE_URL` |

## 7. Defect severity rubric

Used by `playwright-test-healer` to classify a confirmed defect, and by `playwright-defect-raiser` to map it
to tracker columns. Replace the examples with your own quality plan's wording; keep the four levels.

- **P1 — Critical**: show-stopper. A critical journey does not work; users cannot access or use the system.
  A smoke test covering it would fail. Example: `<...>`
- **P2 — Major**: a feature/workflow is unusable to the business with no workaround, but no critical journey
  breaks. Example: `<...>`
- **P3 — Minor**: a logical error or unmet requirement with a workaround; no crash, no business damage.
  Example: `<...>`
- **P4 — Low**: cosmetic/UI only, no functional breakdown. Example: `<...>`

**Tracker mapping** (edit if your tracker's fields differ):

| Severity | Tracker Priority | Tracker Severity |
|---|---|---|
| P1 | Highest | Critical |
| P2 | High | Major |
| P3 | Medium | Minor |
| P4 | Low | Low |

## 8. Test file layout

| What | Path convention |
|---|---|
| Story-wise specs | `tests/stories/<release>/<STORY-KEY>.spec.ts` |
| Module-wise specs | `tests/<module>.spec.ts` |
| Test plans | `specs/<STORY-KEY>.plan.md` + `specs/<STORY-KEY>.plan.csv` |
| Page objects | `pages/<Name>Page.ts`, shared widgets in `pages/common/` |
| Fixtures | `lib/BaseTest.ts` |

## 9. Knowledge sources

This harness is a separate repository from the application. It sees nothing of your source, schema or API
except what is recorded here and in `context/`.

| Source | Reachable by agents? | Where |
|---|---|---|
| Running application | Yes, via `BASE_URL` and the Playwright MCP server | `.env` |
| Database schema | `<yes, via a read-only MCP server / no>` | `.mcp.json` — see [docs/MCP.md](docs/MCP.md) |
| Issue tracker | `<yes, via the tracker MCP server / no — stories pasted, defects imported from CSV>` | `.mcp.json` — see [docs/MCP.md](docs/MCP.md) |
| Application source | `<no / yes, at a path a person reads and distils>` | `<path>` |
| API documentation | `<no / yes>` | `<url or path>` |
| Everything else | Only once distilled into `context/` | `context/BASELINE.md` |

Run `/playwright-context-builder` to establish the baseline — it inventories what is available, explores
the application, and drafts `context/BASELINE.md`, sections 2–4 above, and the navigation-flow plans.
Re-run it when the application gains a module or a role.

**The rule that matters:** a gap recorded in `context/BASELINE.md` section 8 is useful, because it makes
the agents ask. A gap filled with a plausible guess is the most damaging thing in this repository, because
everything downstream will trust it.

## 10. Test strategy — scope, entry and exit criteria

This is the STLC *test planning* artifact: what is tested, when a cycle may start, and when it may close.
The planner agent designs test cases per story; this section is the strategy those cases serve.

The thresholds below are mirrored in `config/projectProfile.ts` → `exitCriteria`, which is what
`npm run report:cycle` evaluates. Keep the two in sync.

### Test types in scope

| Type | In scope? | How |
|---|---|---|
| Functional — UI | `<yes>` | Playwright specs via the page objects |
| Functional — database | `<yes / no>` | DB-backed assertions (section 5) |
| Functional — API | `<yes / no>` | `tests/api/` (section 6) |
| Accessibility | `<yes / no>` | `BasePage.expectNoAccessibilityViolations()`, tagged `@A11y` |
| Performance, load, security | `<no — use dedicated tools>` | Out of scope for this harness |
| Manual | `<yes / no>` | Planner rows with Test Type `Manual`, executed and recorded in `specs/execution/manual-results.csv` |

### Entry criteria

A cycle may not start until these hold. The first two are checked automatically before every run by
`lib/globalSetup.ts`; the rest are the team's call.

- [ ] The application is reachable at `BASE_URL` *(automatic)*
- [ ] The database is reachable, if DB validation is in scope *(automatic)*
- [ ] Every story in the cycle has its issue key and acceptance criteria
- [ ] Every story in the cycle has an approved plan in `specs/<STORY-KEY>.plan.md`
- [ ] Test data is seeded and in a known state
- [ ] `<the build or release under test is deployed to the environment>`

### Exit criteria

A cycle may close when these hold. `npm run report:cycle` evaluates each one and says which are met; the
release decision stays with a person.

| Criterion | Threshold |
|---|---|
| Priority 1 test cases passing | `100` % |
| Priority 2 test cases passing | `95` % |
| Acceptance criteria covered by at least one passing test case | `100` % |
| Open defects at P1 — Critical | `0` |
| Open defects at P2 — Major | `0` |
| Test cases not executed | `0` |

A threshold is a starting point, not a verdict. A cycle that misses one can still ship, if someone decides
so knowingly — the report exists so that the decision is made with the numbers in front of it.

## 11. Setup checklist

- [ ] Sections 1–10 above filled in, no `<...>` placeholders left (including the template version and commit in section 1)
- [ ] `config/projectProfile.ts` updated to match sections 1, 2 and 5
- [ ] `.env` created from `.env.example` and populated
- [ ] `.mcp.json` created from `.mcp.json.example`; Playwright MCP connected; unused servers removed
- [ ] If the tracker server is wired: signed in through `/mcp`, and a story fetches by its key
- [ ] `context/BASELINE.md` written, including its known-unknowns section
- [ ] `data/auth_data.ts` role keys match section 2 (credentials come from `.env`, never inline)
- [ ] `data/testData.ts` keys match section 3
- [ ] `pages/LoginPage.ts` + `pages/DashboardPage.ts` selectors point at the real app
- [ ] One login seed per role in `tests/seeds/`, and each passes: `npx playwright test tests/seeds/`
- [ ] `lib/BaseTest.ts` exposes a fixture per page object
- [ ] One navigation-flow plan per role in section 2, from the template
- [ ] `specs/RegressionTags/regression-tags.md` table matches section 4
- [ ] `npm run db:check` passes (or DB marked out of scope in section 5)
- [ ] `config/projectProfile.ts` → `exitCriteria` matches section 10
- [ ] `npx playwright test tests/example.spec.ts` passes end to end

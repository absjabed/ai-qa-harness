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
| Issue tracker project key | `<e.g. BRS>` |
| Issue key format | `<e.g. BRS-1234>` |

## 2. Roles

The agents use this table to decide which roles a story implicates, which permission boundaries to test, and
which navigation-flow plan to read. One row per role that can log in.

| Role key | Display name | Credential key in `data/auth_data.ts` | Scope of authority | Navigation plan |
|---|---|---|---|---|
| `<admin>` | `<Administrator>` | `testUsers.<admin>` | `<full system configuration>` | `specs/UserFlowsUserRolePermissions/<admin>NavigationFlow.plan.md` |
| `<standardUser>` | `<...>` | `testUsers.<standardUser>` | `<...>` | `specs/UserFlowsUserRolePermissions/<standardUser>NavigationFlow.plan.md` |
| `<readOnlyUser>` | `<...>` | `testUsers.<readOnlyUser>` | `<view-only>` | `specs/UserFlowsUserRolePermissions/<readOnlyUser>NavigationFlow.plan.md` |

**Baseline role** (the full-access role every other role's restrictions are defined against): `<role key>`

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
| Database engine | `<SQL Server>` — `config/DbConnection.ts` ships with `mssql`; swap the driver if different |
| DB validation in scope? | `<yes / no>` — if no, agents skip all DB-backed assertion guidance |
| Schema owner/prefix | `<e.g. dbo>` |
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
| Application source | `<no / yes, at a path a person reads and distils>` | `<path>` |
| API documentation | `<no / yes>` | `<url or path>` |
| Everything else | Only once distilled into `context/` | `context/BASELINE.md` |

Run `/playwright-context-builder` to establish the baseline — it inventories what is available, explores
the application, and drafts `context/BASELINE.md`, sections 2–4 above, and the navigation-flow plans.
Re-run it when the application gains a module or a role.

**The rule that matters:** a gap recorded in `context/BASELINE.md` section 8 is useful, because it makes
the agents ask. A gap filled with a plausible guess is the most damaging thing in this repository, because
everything downstream will trust it.

## 10. Setup checklist

- [ ] Sections 1–9 above filled in, no `<...>` placeholders left
- [ ] `config/projectProfile.ts` updated to match sections 1, 2 and 5
- [ ] `.env` created from `.env.example` and populated
- [ ] `.mcp.json` created from `.mcp.json.example`; Playwright MCP connected
- [ ] `context/BASELINE.md` written, including its known-unknowns section
- [ ] `data/auth_data.ts` role keys match section 2 (credentials come from `.env`, never inline)
- [ ] `data/testData.ts` keys match section 3
- [ ] `pages/LoginPage.ts` + `pages/DashboardPage.ts` selectors point at the real app
- [ ] `lib/BaseTest.ts` exposes a fixture per page object
- [ ] One navigation-flow plan per role in section 2, from the template
- [ ] `specs/RegressionTags/regression-tags.md` table matches section 4
- [ ] `npm run db:check` passes (or DB marked out of scope in section 5)
- [ ] `npx playwright test tests/example.spec.ts` passes end to end

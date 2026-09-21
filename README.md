# AI Test Harness — Playwright + TypeScript

An AI-driven test automation harness. Five Claude agents learn your application, plan, generate, heal, and
file defects against a Playwright + TypeScript suite built on the Page Object / Page Factory pattern.

It is application-agnostic: everything project-specific lives in **`PROJECT-PROFILE.md`** and **`.env`**.
Nothing in `.claude/`, `config/`, or `lib/` names an application, a role, or a domain term.

## Using this template

This repository is a template, not a project. Nothing in it is specific to any application — you copy it,
point it at yours, and the copy becomes that project's test suite.

```bash
# GitHub template repository (Settings → General → Template repository)
gh repo create <org>/<app>-tests --private --template <org>/ai-qa-harness --clone

# or a plain copy, no git history
git clone --depth 1 <this-repo-url> <app>-tests && rm -rf <app>-tests/.git && git -C <app>-tests init
```

Then work through **[SETUP.md](SETUP.md)** — about an hour, and the copy is testing your application.

Improvements you make while working on a project belong back here **only if they are application-agnostic**:
a sharper agent prompt, a new `BasePage` helper, a better error message. Anything that names your
application stays in your copy. That is the line that keeps this template reusable.

## Documentation

| Doc | For |
|---|---|
| **[docs/index.html](docs/index.html)** | The handbook — open it in a browser. Setup, agents, components, workflows, troubleshooting in one navigable page. Start here. |
| [SETUP.md](SETUP.md) | The ten setup steps, with the reasoning behind each |
| [docs/COMPONENTS.md](docs/COMPONENTS.md) | Every file: purpose, usage, extension points, failure modes |
| [docs/AGENTS.md](docs/AGENTS.md) | The five agents: inputs, outputs, checkpoints, what to expect, what they refuse |
| [docs/WORKFLOWS.md](docs/WORKFLOWS.md) | End-to-end recipes — first story, healing a regression, onboarding, porting |
| [docs/MCP.md](docs/MCP.md) | Wiring the browser and database MCP servers, and why read-only matters |
| [context/README.md](context/README.md) | What project knowledge goes in `context/`, and in what shape |
| [PROJECT-PROFILE.md](PROJECT-PROFILE.md) | The file you fill in per project |
| [.claude/TEST-AUTHORING-INVARIANTS.md](.claude/TEST-AUTHORING-INVARIANTS.md) | I1–I7, the conventions every test follows |

## What the AI layer does

Five agents in `.claude/commands/`, run as slash commands. They hand off in sequence but each works alone.

| Agent | Input | Output |
|---|---|---|
| `playwright-context-builder` | The application, plus whatever access exists | `context/BASELINE.md`, context docs, drafts of the profile and flow plans |
| `playwright-test-planner` | A story pasted into the conversation | `specs/<KEY>.plan.md` + `specs/<KEY>.plan.csv` |
| `playwright-test-generator` | An approved plan | A spec file, plus any page objects and fixtures it needed |
| `playwright-test-healer` | Failing tests | Fixed tests, or a confirmed defect in `specs/temp-defects/defect-log.json` |
| `playwright-defect-raiser` | That defect log | Rows in `specs/defects.csv` + the tests marked `test.fixme()` |

Two things distinguish this from asking an LLM to write tests:

**The generator does not write from plan text.** It drives the real browser through the Playwright MCP
server first, reads back its own action log, and refuses to write a test for any step that has no recorded
action. Plan text states intent; only the drive establishes what the DOM actually does.

**They stop and ask.** The context-builder works in checkpoints and records what it could not establish
rather than guessing; the planner has seven mandatory approval checkpoints; the generator blocks on the
target file path and on any new page object it is about to create. None invents a selector, a data key, or
a SQL query when it can't find one — it flags the gap instead.

**It is fed deliberately.** The harness is a separate repository from the application, so it sees nothing
of your source, schema or API except what someone puts in `context/`. `playwright-context-builder` does the
first pass; `context/README.md` explains what belongs there and why distilled beats dumped.

## Conventions

`.claude/TEST-AUTHORING-INVARIANTS.md` holds invariants I1–I7 — one file, cited by number from the three
authoring agents so a convention has a single place to change.

| | Invariant |
|---|---|
| I1 | Page Object Model — no raw locator in a spec file |
| I2 | Page Factory fixtures — no `new SomePage(page)` |
| I3 | Centralized test data and SQL — no literals, no inline SQL |
| I4 | Credentials from `data/auth_data.ts` via `userLogin` — never inline, values live in `.env` |
| I5 | No hardcoded assertion values — assert against runtime-obtained values |
| I6 | Environment-driven config — no literal URL or DB credential anywhere |
| I7 | Locator uniqueness — scope anything that could match more than one element |

## Layout

```
.claude/
  TEST-AUTHORING-INVARIANTS.md   I1-I7, the single source of truth
  commands/                      the five agents
context/
  README.md                      what project knowledge goes here, and in what shape
  BASELINE.md                    what is known about the app - and what is not
  _TEMPLATE.md                   the shape of a per-area context document
config/
  projectProfile.ts              machine-readable mirror of PROJECT-PROFILE.md
  testConfig.ts                  env-driven config; throws on missing required vars
  DbConnection.ts                SQL Server pool, with fail-fast on persistent refusals
  testDbConnection.ts            `npm run db:check`
data/
  auth_data.ts                   credentials, resolved from .env per role
  testData.ts                    domain values, boundaries, adversarial inputs
  sql_queries.ts                 every query the suite uses
lib/
  BaseTest.ts                    the Page Factory - one fixture per page object
  api/ApiClient.ts               optional API client
pages/
  BasePage.ts                    shared navigation, waiting, table-reading, DB comparison
  LoginPage.ts, DashboardPage.ts templates, wired and ready to repoint
  common/                        widgets shared across screens
specs/
  TEMPLATES/                     plan markdown + CSV templates
  RegressionTags/                the tag registry the generator reads
  ScenarioGenerationPatterns/    page-wise / role-wise replication rules
  UserFlowsUserRolePermissions/  per-role navigation and permission plans
tests/
  example.spec.ts                reference spec demonstrating I1-I7
  seed.spec.ts                   the generator's live-drive starting point
  common/                        test-side helpers
PROJECT-PROFILE.md               the one file you fill in per project
.env.example                     copy to .env
.mcp.json.example                copy to .mcp.json - browser + optional database access
```

## Running

```bash
npm install && npx playwright install
npm test                      # everything
npm run test:regression       # --grep "@Regression"
npm run test:headed
npm run test:ui
npm run test:api              # the api project only
npm run db:check              # database connectivity
npm run typecheck             # tsc --noEmit
npm run report                # open the last HTML report
```

Filter by tag:

```bash
npx playwright test --grep "@Priority1"
npx playwright test --grep "(?=.*@Regression)(?=.*@YourModule)"
```

## Tagging

Every test carries a Priority tag and a module tag, applied by the generator from the plan's `Priority`
and `Sub Module` fields:

- `Priority 1` → `['@Regression', '@Priority1', '@Module']`
- `Priority 2` → `['@Regression', '@Priority2', '@Module']`
- `Priority 3` → `['@Priority3', '@Module']` — no `@Regression`

Module tags are registered in `specs/RegressionTags/regression-tags.md`. The generator will not invent a
tag name; it asks, then writes the new row itself.

Tags go in `{ tag: [...] }`, never in a `test.describe` title — `--grep` matches against the full title
string, so a role name written into a title produces false-positive matches. That file's Gotchas section
has the rest.

## Requirements

- Node.js 18+
- The Playwright Test MCP server, for the context-builder, generator and healer agents
- Optionally a read-only database MCP server — see [docs/MCP.md](docs/MCP.md)
- SQL Server access, if DB validation is in scope (`PROJECT-PROFILE.md` section 5)

## Security

`.env` holds every credential and is gitignored. `data/auth_data.ts` resolves them at runtime and throws
if a role is unconfigured — it never contains a password. Nothing in the repo should ever hold a real
credential; if you find one, treat it as an incident, not a cleanup task.

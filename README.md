# AI Test Harness — Playwright + TypeScript

An AI-driven test automation harness. Six agents learn your application, plan, generate, review, heal,
and file defects against a Playwright + TypeScript suite built on the Page Object / Page Factory pattern. A
seventh adapts the harness itself when it does not behave as your team needs.

The agents are defined in [`agents/`](agents/) as plain, vendor-neutral markdown. Claude Code wrappers ship
in `.claude/`; adding another tool is a one-line wrapper each — see [`agents/README.md`](agents/README.md).

It is application-agnostic: everything project-specific lives in **`PROJECT-PROFILE.md`** and **`.env`**.
Nothing in `.claude/`, `config/`, or `lib/` names an application, a role, or a domain term.

## Start here — the handbook

**[`docs/index.html`](docs/index.html)** is the single page that explains the whole harness: how it learns
your application, the ten setup steps, what each of the seven agents does and refuses to do, every component
in plain language, the workflows, and troubleshooting. Read it before the rest of this README.

It is a self-contained page — no build step, no server, no network beyond its webfonts. From a clone:

```bash
npm run docs
```

Or open `docs/index.html` in a browser yourself.

> **Don't click it in GitHub's web UI.** GitHub serves `.html` as source, so you'll get 88 KB of markup
> rather than the page.
>
> **There is deliberately no hosted URL**, and GitHub Pages is not the answer. Two independent reasons,
> both checked rather than assumed:
>
> 1. Pages on a **private** repo needs a paid plan. On Free the API refuses outright —
>    `Your current plan does not support GitHub Pages for this repository` (HTTP 422).
> 2. More importantly, **Pages does not inherit repository privacy**. On Pro or Team the repo stays
>    private but the published site is readable by anyone with the URL. Access-controlled Pages is an
>    Enterprise Cloud feature. "Private repo" and "private docs" are not the same thing.
>
> So the handbook stays a local file. If you ever do want a shared URL, use an internal host rather than
> Pages — unless publishing this publicly is a deliberate decision.

## Using this template

This repository is a template, not a project. Nothing in it is specific to any application — you copy it,
point it at yours, and the copy becomes that project's test suite.

```bash
# recommended: copy the harness into the project's QA repository
npm run export -- ../<app>-qa

# or the whole repository, via GitHub's template feature
gh repo create <you>/<app>-tests --private --template <you>/ai-qa-harness --clone
```

The export copies exactly the files a project needs — dotfiles included — leaves the template-only ones
behind, names the package, and records which harness version and commit the copy came from. Copying by
hand works too; [SETUP.md](SETUP.md) step 0 lists what not to miss.

Then follow **[docs/NEW-QA-REPO.md](docs/NEW-QA-REPO.md)** — the step-by-step for a new QA repo — with
[SETUP.md](SETUP.md) as the reference behind each step.

Improvements you make while working on a project belong back here **only if they are application-agnostic**:
a sharper agent prompt, a new `BasePage` helper, a better error message. Anything that names your
application stays in your copy. That is the line that keeps this template reusable.

## Documentation

| Doc | For |
|---|---|
| **[docs/index.html](docs/index.html)** | **The handbook** — everything in one navigable page. Open from a local clone, not GitHub's web UI (see above). |
| **[docs/NEW-QA-REPO.md](docs/NEW-QA-REPO.md)** | **Starting a project's QA repo** — the files copied into it, the minimum to configure, and the checklist before the context-builder |
| [SETUP.md](SETUP.md) | The ten setup steps, with the reasoning behind each |
| [docs/COMPONENTS.md](docs/COMPONENTS.md) | Every file: purpose, usage, extension points, failure modes |
| [docs/AGENTS.md](docs/AGENTS.md) | The seven agents: inputs, outputs, checkpoints, what to expect, what they refuse |
| [docs/WORKFLOWS.md](docs/WORKFLOWS.md) | End-to-end recipes — first story, healing a regression, onboarding, porting |
| [docs/MCP.md](docs/MCP.md) | Wiring the browser, database and Jira MCP servers, and the guard rails |
| [docs/qa-harness-intro.html](docs/qa-harness-intro.html) | Three slides for introducing the harness to a QA team: how they test today, how they will with it |
| [docs/qa-harness-walkthrough.html](docs/qa-harness-walkthrough.html) | One example cycle, step by step: setup, one ticket, regression and closure — what you run, what each agent asks, what comes out |
| [examples/fleetkeep/README.md](examples/fleetkeep/README.md) | A practice app to learn the harness on before a real project — `npm run export -- <dir> --example fleetkeep` — and one ticket's whole cycle, worked |
| [context/README.md](context/README.md) | What project knowledge goes in `context/`, and in what shape |
| [PROJECT-PROFILE.md](PROJECT-PROFILE.md) | The file you fill in per project |
| [TEST-AUTHORING-INVARIANTS.md](TEST-AUTHORING-INVARIANTS.md) | I1–I8, the conventions every test follows |
| [agents/README.md](agents/README.md) | Using these agents with a tool other than Claude Code |
| [CHANGELOG.md](CHANGELOG.md) | The harness version, and what changed between harness versions |
| [HARNESS-CHANGES.md](HARNESS-CHANGES.md) | In a QA repo: the changes it made to its own harness, why, and which are worth sending back |

## Coverage of the testing lifecycle

| STLC phase | Where it lives |
|---|---|
| Requirement analysis | `playwright-context-builder`; the planner's first checkpoint; each plan's AC traceability table |
| Test planning | `PROJECT-PROFILE.md` section 10 — scope, entry and exit criteria |
| Test case design | `playwright-test-planner` — ISTQB techniques, Given/When/Then, one TCID per case |
| Environment setup | `.env`, `.mcp.json`, and the readiness check in `lib/globalSetup.ts`; `data/seed.ts` |
| Execution | Playwright; `playwright-test-generator` automates, `playwright-test-healer` triages; `npm run regression` per client release; manual results in `specs/execution/` |
| Defect management | healer → defect log → `playwright-defect-raiser` → a bug in the tracker (or a CSV to import); retest confirms the fix |
| Cycle closure | The cycle report — written after every run, and by `npm run regression` for a release's chosen tickets: metrics, AC coverage and exit criteria |

Traceability holds it together: every test case is `<STORY-KEY>-TC<NNN>`, that ID starts every test's title,
and every defect carries it — so a failure leads back to the acceptance criterion it breaks. The handbook's
*Lifecycle* section covers each phase and what is still out of scope.

## What the AI layer does

Seven agents, defined in `agents/` and run as slash commands via the `.claude/` wrappers. Six test — they hand off in sequence but each works alone — and one maintains the harness.

| Agent | Input | Output |
|---|---|---|
| `playwright-context-builder` | The application, plus whatever access exists | `context/BASELINE.md`, context docs, drafts of the profile and flow plans |
| `playwright-test-planner` | A story key — fetched from the tracker if wired, otherwise the story pasted in | `specs/<KEY>.plan.md` + `specs/<KEY>.plan.csv` |
| `playwright-test-generator` | An approved plan | A spec file, plus any page objects and fixtures it needed — reviewed against the plan before it finishes |
| `playwright-test-reviewer` | A plan and its ticket, or a spec and its plan — started by the planner (if you agree) and the generator (always) | Findings: `must fix` and `consider`, each tied to a TCID and its source. Edits nothing |
| `playwright-test-healer` | The failing tests of a story, spec or run | Fixed tests, or a confirmed defect in `specs/defects/defect-log.json` with its screenshots |
| `playwright-defect-raiser` | The pending defects | Bugs created in the tracker, linked and with evidence, or rows in `specs/defects/defects.csv` + the tests marked `test.fixme()` |
| `playwright-harness-improver` | A case where the harness did not behave as the team needs, or a convention it should follow | The smallest change in the right file, applied on your yes, with the docs that restate it — and an entry in `HARNESS-CHANGES.md` |

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

`TEST-AUTHORING-INVARIANTS.md` holds invariants I1–I8 — one file, cited by number from the three
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
agents/                          the seven agent definitions - canonical, vendor-neutral
  README.md                      porting them to another tool
.claude/
  commands/                      thin Claude Code wrappers - one line each, no instructions
  agents/                        the reviewer as a sub-agent, so other agents start it in a fresh context
  settings.json                  guard rails: no .env reads, no DB writes, ask before tracker writes
TEST-AUTHORING-INVARIANTS.md     I1-I8, the single source of truth
HARNESS-CHANGES.md               every change a QA repo makes to its own harness, and why
context/
  README.md                      what project knowledge goes here, and in what shape
  BASELINE.md                    what is known about the app - and what is not
  _TEMPLATE.md                   the shape of a per-area context document
  sources/                       existing specs, test cases, bug lists, Jira exports to read
config/
  projectProfile.ts              machine-readable mirror of PROJECT-PROFILE.md
  testConfig.ts                  env-driven config; throws on missing required vars
  DbConnection.ts                SQL Server or PostgreSQL, with fail-fast on persistent refusals
  db/                            one adapter per engine, and the contract between them
  testDbConnection.ts            `npm run db:check`
data/
  auth_data.ts                   credentials, resolved from .env per role
  testData.ts                    domain values, boundaries, adversarial inputs
  sql_queries.ts                 every query the suite uses
  seed.ts                        reset + seed test data into a known state
lib/
  BaseTest.ts                    the Page Factory - one fixture per page object, plus `cleanup`
  globalSetup.ts                 entry-criteria check before every run; optional seeding
  cycleReporter.ts               writes the cycle report as each run ends
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
  execution/                     the cycle's results - automated and manual, per TCID - and closure reports
  defects/                       the defect log, its evidence, and bugs to import without Jira
tests/
  example.spec.ts                reference spec demonstrating I1-I8
  seed.spec.ts                   live-drive starting point for a signed-out scenario
  seeds/                         one login per role - agents start here, never touching a password
  common/                        test-side helpers
docs/
  index.html                     the handbook - `npm run docs` opens it
  qa-harness-intro.html          three-slide introduction for a QA team
  qa-harness-walkthrough.html    one example cycle, step by step - what you run, what it asks, what comes out
  NEW-QA-REPO.md                 starting a project's QA repo - files, minimum config, checklist
examples/
  fleetkeep/                     a practice app and one ticket's worked cycle - never exported to a project
scripts/
  open-docs.js                   opens the handbook cross-platform
  export-harness.js              copies the harness into a project's QA repo
  check-docs.js                  asserts the docs still match the repo
  check-trace.ts                 enforces I8 - TCIDs present, planned, unique
  regression.ts                  regression for a client release - pick its tickets or epics
  cycle-report.ts                rebuild the cycle report by hand
  lib/cycle.ts                   builds the cycle report
  lib/trace.ts                   the parser all of them share
PROJECT-PROFILE.md               the one file you fill in per project
.env.example                     copy to .env
.mcp.json.example                copy to .mcp.json - browser + optional database access
```

## Running

```bash
npm install && npx playwright install
npm run docs                  # open the handbook
npm run export -- <dir>       # copy the harness into a project's QA repo
npm test                      # everything
npm run regression            # a client release: pick its tickets or epics, run, report
npm run test:regression       # every test tagged @Regression
npm run test:headed
npm run test:ui
npm run test:api              # the api project only
npm run db:check              # database connectivity
npm run typecheck             # tsc --noEmit
npm run check:docs            # docs still match the repo
npm run check:trace           # every test traceable to its test case (I8)
npm run check                 # all three of the above
npm run report                # open the last HTML report
npm run report:cycle          # rebuild the cycle report by hand (it is also written after every run)
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
- An agentic coding tool. Claude Code works out of the box; any MCP-capable tool works with a one-line wrapper per agent
- The Playwright test MCP server (`npx playwright run-test-mcp-server`, ships with `@playwright/test`) — for the context-builder, generator and healer
- Optionally a read-only database MCP server, and an issue-tracker MCP server for Jira — see [docs/MCP.md](docs/MCP.md)
- SQL Server or PostgreSQL access, if DB validation is in scope (`PROJECT-PROFILE.md` section 5)

## Security

`.env` holds every credential and is gitignored. `data/auth_data.ts` resolves them at runtime and throws
if a role is unconfigured — it never contains a password. Nothing in the repo should ever hold a real
credential; if you find one, treat it as an incident, not a cleanup task.

Agents never see a password: when one needs to be logged in it starts from its role's seed in
`tests/seeds/`, which logs in inside the test runner. `.claude/settings.json` denies agents reading `.env`
and `.mcp.json`, denies the database server's write tools, and makes every write to the tracker ask a
person first.

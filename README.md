# AI Test Harness — Playwright + TypeScript

An AI-driven test automation harness. Five agents learn your application, plan, generate, heal, and file
defects against a Playwright + TypeScript suite built on the Page Object / Page Factory pattern.

The agents are defined in [`agents/`](agents/) as plain, vendor-neutral markdown. Claude Code wrappers ship
in `.claude/`; adding another tool is a one-line wrapper each — see [`agents/README.md`](agents/README.md).

It is application-agnostic: everything project-specific lives in **`PROJECT-PROFILE.md`** and **`.env`**.
Nothing in `.claude/`, `config/`, or `lib/` names an application, a role, or a domain term.

## Start here — the handbook

**[`docs/index.html`](docs/index.html)** is the single page that explains the whole harness: how it learns
your application, the ten setup steps, what each of the five agents does and refuses to do, every component
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
| **[docs/index.html](docs/index.html)** | **The handbook** — everything in one navigable page. Open from a local clone, not GitHub's web UI (see above). |
| [SETUP.md](SETUP.md) | The ten setup steps, with the reasoning behind each |
| [docs/COMPONENTS.md](docs/COMPONENTS.md) | Every file: purpose, usage, extension points, failure modes |
| [docs/AGENTS.md](docs/AGENTS.md) | The five agents: inputs, outputs, checkpoints, what to expect, what they refuse |
| [docs/WORKFLOWS.md](docs/WORKFLOWS.md) | End-to-end recipes — first story, healing a regression, onboarding, porting |
| [docs/MCP.md](docs/MCP.md) | Wiring the browser and database MCP servers, and why read-only matters |
| [context/README.md](context/README.md) | What project knowledge goes in `context/`, and in what shape |
| [PROJECT-PROFILE.md](PROJECT-PROFILE.md) | The file you fill in per project |
| [TEST-AUTHORING-INVARIANTS.md](TEST-AUTHORING-INVARIANTS.md) | I1–I7, the conventions every test follows |
| [agents/README.md](agents/README.md) | Using these agents with a tool other than Claude Code |
| [CHANGELOG.md](CHANGELOG.md) | What changed between template versions, and whether a copy should adopt it |

## What the AI layer does

Five agents, defined in `agents/` and run as slash commands via the `.claude/` wrappers. They hand off in sequence but each works alone.

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

`TEST-AUTHORING-INVARIANTS.md` holds invariants I1–I7 — one file, cited by number from the three
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
agents/                          the five agent definitions - canonical, vendor-neutral
  README.md                      porting them to another tool
.claude/
  commands/                      thin Claude Code wrappers - one line each, no instructions
TEST-AUTHORING-INVARIANTS.md     I1-I7, the single source of truth
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
docs/
  index.html                     the handbook - `npm run docs` opens it
scripts/
  open-docs.js                   opens the handbook cross-platform
  check-docs.js                  asserts the docs still match the repo
.github/workflows/               typecheck + docs check on every push
PROJECT-PROFILE.md               the one file you fill in per project
.env.example                     copy to .env
.mcp.json.example                copy to .mcp.json - browser + optional database access
```

## Running

```bash
npm install && npx playwright install
npm run docs                  # open the handbook
npm test                      # everything
npm run test:regression       # --grep "@Regression"
npm run test:headed
npm run test:ui
npm run test:api              # the api project only
npm run db:check              # database connectivity
npm run typecheck             # tsc --noEmit
npm run check:docs            # docs still match the repo
npm run check                 # both of the above
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
- An agentic coding tool. Claude Code works out of the box; any MCP-capable tool works with a one-line wrapper per agent
- The Playwright test MCP server (`npx playwright run-test-mcp-server`, ships with `@playwright/test`) — for the context-builder, generator and healer
- Optionally a read-only database MCP server — see [docs/MCP.md](docs/MCP.md)
- SQL Server access, if DB validation is in scope (`PROJECT-PROFILE.md` section 5)

## Security

`.env` holds every credential and is gitignored. `data/auth_data.ts` resolves them at runtime and throws
if a role is unconfigured — it never contains a password. Nothing in the repo should ever hold a real
credential; if you find one, treat it as an incident, not a cleanup task.

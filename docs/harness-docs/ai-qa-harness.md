# AI Test Harness — how the agent system works

The AI Test Harness is a QA layer for Claude Code: nine specialist agents, shared project knowledge, a
Playwright + TypeScript test suite, and the npm scripts around it. Eight agents learn the application, plan
test cases, generate tests, review them, run them, heal failures, file defects and write the test report; a
ninth adapts the harness itself. Each agent stops at human approval gates and works on its story's own git
branch, and permission rules in `.claude/settings.json` limit what any agent may do. This guide explains how
the pieces fit together, with a diagram for each part.

- **Audience:** QA engineers and QA leads who run the agents, and whoever maintains a project's copy of the
  harness.
- **Where it lives:** [agents/README.md](../../agents/README.md) (agent definitions),
  [context/README.md](../../context/README.md) (project knowledge),
  [specs/execution/README.md](../../specs/execution/README.md) (results, reports and closure),
  [specs/defects/README.md](../../specs/defects/README.md) (defect log),
  [docs/GIT-WORKFLOW.md](../GIT-WORKFLOW.md) (branches and commits), and the command reference in
  [docs/AGENTS.md](../AGENTS.md).
- **Diagrams:** the editable source is one multi-page draw.io file,
  [ai-qa-harness.drawio](diagrams/ai-qa-harness/ai-qa-harness.drawio). The PNGs are exported from it (see
  [Updating the diagrams](#updating-the-diagrams)).

## Contents

1. [Architecture — agents, knowledge, test suite](#1-architecture--agents-knowledge-test-suite)
2. [Agent pattern — command, definition, sub-agent](#2-agent-pattern--command-definition-sub-agent)
3. [End-to-end testing lifecycle](#3-end-to-end-testing-lifecycle)
4. [Context-builder setup](#4-context-builder-setup)
5. [Test planning](#5-test-planning)
6. [Test generation](#6-test-generation)
7. [Running tests](#7-running-tests)
8. [Healing failures](#8-healing-failures)
9. [Defects and retest](#9-defects-and-retest)
10. [Regression, reports and closure](#10-regression-reports-and-closure)
11. [Git workflow](#11-git-workflow)
12. [Guardrails](#12-guardrails)
13. [Harness improvement](#13-harness-improvement)
14. [Cross-cutting concepts](#14-cross-cutting-concepts)
15. [Which command do I use?](#15-which-command-do-i-use)
16. [Updating the diagrams](#updating-the-diagrams)

---

## 1. Architecture — agents, knowledge, test suite

![Architecture — agent layer, knowledge layer, scripts, test suite and records, with the systems outside the harness](diagrams/ai-qa-harness/01-architecture.png)

You work in a Claude Code session opened in the project's QA repo, or in a terminal in the same repo. The
agents read the knowledge layer and write the test suite. Test runs and scripts leave records.

| Layer | Folder | Holds | Executes? |
|---|---|---|---|
| Agent | `.claude/`, `agents/` | Slash commands, agent definitions, the sub-agent, permission rules | Yes — Claude Code runs the agents |
| Knowledge | `PROJECT-PROFILE.md`, `TEST-AUTHORING-INVARIANTS.md`, `context/`, `specs/` | What the agents know about the application and the rules tests follow | No |
| Test suite | `tests/`, `pages/`, `lib/`, `data/`, `config/`, `playwright.config.ts` | The Playwright suite | Yes — Playwright runs it |
| Scripts | `scripts/` | Export, prep, regression, reports, git, checks | Yes — `npm run …` |
| Records | `specs/execution/`, `specs/defects/`, `HARNESS-CHANGES.md` | Results, reports, defects, closure reports, harness changes | No |

**Agent layer**

| Path | Purpose |
|---|---|
| [.claude/commands/](../../.claude/commands/) | Nine slash-command wrappers, each pointing at its definition |
| [agents/](../../agents/) | The nine canonical agent definitions |
| [.claude/agents/](../../.claude/agents/) | The `playwright-test-reviewer` sub-agent |
| [.claude/settings.json](../../.claude/settings.json) | Permission rules: allow, ask, deny |
| [.mcp.json.example](../../.mcp.json.example) | MCP servers: `playwright-test`, `database`, `tracker`, `figma`; copied to `.mcp.json`, which is gitignored |

**Knowledge layer**

| Path | Purpose |
|---|---|
| [PROJECT-PROFILE.md](../../PROJECT-PROFILE.md) | Roles, vocabulary, modules, severity rubric, test strategy, exit criteria |
| [TEST-AUTHORING-INVARIANTS.md](../../TEST-AUTHORING-INVARIANTS.md) | Rules I1–I8 every test follows |
| [context/](../../context/) | `BASELINE.md`, one document per area, and `sources/` for the project's documents |
| [specs/](../../specs/) | Plans, plan templates, navigation flows per role, regression tags |

**Test suite**

| Path | Purpose |
|---|---|
| [tests/](../../tests/) | `seeds/` (one login file per role), `seed.spec.ts` (signed out), `stories/`, `example.spec.ts` |
| [pages/](../../pages/) | Page objects, including `LoginPage.ts`, `DashboardPage.ts` and `common/Logout.ts` |
| [lib/](../../lib/) | `BaseTest.ts` fixtures, `globalSetup.ts` readiness check, `cycleReporter.ts` |
| [data/](../../data/) | `testData.ts`, `auth_data.ts`, `sql_queries.ts`, `seed.ts` |
| [config/](../../config/) | `projectProfile.ts`, `testConfig.ts`, `DbConnection.ts` and its adapters |

**Scripts and records**

| Path | Purpose |
|---|---|
| [scripts/](../../scripts/) | `regression.ts`, `last-run.ts`, `cycle-report.ts`, `defect-evidence.ts`, `context-sync.ts`, `story.ts`, `env.js`, `check-docs.js`, `check-trace.ts`; in the template only, `export-harness.js` and `prep-folder.js` |
| [specs/execution/](../../specs/execution/) | `automated-results.csv`, `manual-results.csv`, `reports/` (formal reports), `closure/` |
| [specs/defects/](../../specs/defects/) | `log/` (one file per defect), `evidence/`, `defects.csv` |
| [HARNESS-CHANGES.md](../../HARNESS-CHANGES.md) | Changes a QA repo makes to its own harness |

**Optional integrations.** The `playwright-test` MCP server is required by the context-builder, generator and
healer. The `database` server (a read-only QA account) is optional: without it, agents ask you for queries and
the healer reports database-backed failures instead of judging them. Jira is optional, through the Atlassian
plugin or the `tracker` MCP entry: without it, you paste stories into the planner, the defect-raiser writes
`specs/defects/defects.csv` for import, and you tell the healer which defects were fixed. Figma is optional,
read-only, through the `figma` entry or the Figma plugin: without it, designs are pasted as screenshots. See
[docs/MCP.md](../MCP.md).

---

## 2. Agent pattern — command, definition, sub-agent

![Agent pattern — nine slash commands, their canonical definitions, and the reviewer sub-agent](diagrams/ai-qa-harness/02-agent-pattern.png)

An agent is reached in one of three ways:

1. **A slash command.** `.claude/commands/<name>.md` holds Claude Code frontmatter (`description`,
   `allowed-tools`, `model`, and `effort` for two agents) and one instruction: read
   `agents/<name>.md` and follow it.
2. **The canonical definition.** `agents/<name>.md` holds all of the agent's instructions, in plain markdown.
3. **A sub-agent.** `.claude/agents/playwright-test-reviewer.md` lets the planner and the generator start the
   reviewer in a fresh context. It also points at `agents/playwright-test-reviewer.md`.

Wrappers defer to the definition. For example, to change how the healer treats a failing assertion, you edit
`agents/playwright-test-healer.md`; the wrapper `.claude/commands/playwright-test-healer.md` stays as it is.
`npm run check:docs` fails if a wrapper or sub-agent file has no matching definition, does not point at it,
or grows beyond 8 lines of content.

Notable settings:

- **Model:** every command and the sub-agent use `opus`, except the reporter, which uses `sonnet` — its
  numbers come from the script; the context-builder and planner also set `effort: xhigh`.
- **Read-only:** the reviewer sub-agent has `tools: Glob, Grep, Read` and never edits or asks.
- **Who starts it:** the planner offers a plan review before saving; the generator reviews every spec it
  writes unless you say no review; you can run `/playwright-test-reviewer` directly.
- **Shared reading:** all nine agents read `PROJECT-PROFILE.md` first; six read
  `TEST-AUTHORING-INVARIANTS.md` (the defect-raiser, executor and reporter do not).
- **Hand-overs go through files.** The generator offers the executor; the executor hands over to the healer,
  defect-raiser, reporter and context-builder. Each reads its input from disk, so a session that ends
  mid-way resumes with the same command.

---

## 3. End-to-end testing lifecycle

![Testing lifecycle — seven stages from an empty folder to a closed release, the files each stage writes, and the git branch every story works on](diagrams/ai-qa-harness/03-testing-lifecycle.png)

```text
npm run prep -- <dir> --name "<project>"     → setup/ · context/sources/
npm run export -- <dir>                      → the harness files in the QA repo
/playwright-context-builder                  → context/BASELINE.md · context/<area>.md · PROJECT-PROFILE.md §2–4
npm run story -- start <ISSUE-KEY>           → test/<ISSUE-KEY>-<desc>, from the base branch you pick
/playwright-test-planner <ISSUE-KEY>         → specs/<ISSUE-KEY>.plan.md · .plan.csv · manual-results.csv rows
/playwright-test-generator <plan>            → tests/stories/<release>/<ISSUE-KEY>.spec.ts · pages/ · lib/BaseTest.ts
/playwright-test-executor <ISSUE-KEY>        → specs/execution/automated-results.csv · reports/
/playwright-test-healer <ISSUE-KEY>          → fixed tests · specs/defects/log/<entry id>.json · evidence/
/playwright-defect-raiser                    → Jira bug or specs/defects/defects.csv · test.fixme(
npm run story -- finish <ISSUE-KEY>          → the latest base merged in; a pull request into release/<release>
/playwright-test-executor (regression)       → automated-results.csv · reports/cycle-summary-release-<release>-…
/playwright-test-reporter                    → specs/execution/reports/QA-Report_<app>_<scope>.md · .html · .pdf
npm run report:cycle -- --closure            → specs/execution/closure/
```

Key points:

- **Setup happens once.** Prep, export and the context-builder run when a project starts. The context-builder
  runs again only when the application changes.
- **Plan to raise repeats per ticket**, on the ticket's own branch. Every story needs its issue key; test case
  IDs start with it.
- **Each stage reads files, not conversation.** A plan approved one day generates fine the next.
- **Every run is recorded.** `lib/cycleReporter.ts` writes each test case's latest result and a cycle report as
  the run ends; each agent commits its own stage.

Other ways in: `/playwright-test-healer` to retest raised defects, `/playwright-test-reviewer` on any plan or
spec, `/playwright-harness-improver` when the harness does not fit, and `npm run export -- <dir> --example <name>`
for a practice repo.

---

## 4. Context-builder setup

![Context-builder setup — preflight, inventory, read-only roam, sources, drafts, with seven STOP checkpoints](diagrams/ai-qa-harness/04-context-builder-setup.png)

`/playwright-context-builder` establishes what the harness knows about the application. Things to know when
you run it:

| Step | What happens |
|---|---|
| 0 · Preflight | Confirms or sets up the roles, runs every login file, offers to fill the login, signed-in and sign-out selectors, fetches one Jira story and makes one Figma read to prove the connections |
| 1 · Inventory | Asks by name which sources exist and can be reached |
| 2 · Roam | Signed out first (`tests/seed.spec.ts`), then each role (`tests/seeds/<role>.spec.ts`), read-only |
| 3 · Read | Specs and rules → Invariants with sources; test cases → Existing coverage; defects → Caveats; Jira live or from a CSV export; designs → Design intent |
| 4 · Introspect | Only with a reachable database and the MCP server; read-only |
| 5–8 · Write | `context/BASELINE.md`, profile §2–4 and module tags, navigation plans and the cross-role matrix, deep context per named area |

- **STOP gates:** review the preflight · correct the inventory · review the module map · approve the baseline ·
  show each profile draft · show the navigation drafts · show each context document. A failed login stops it to
  ask whether to carry on with the other roles.
- **It never handles a password.** It starts from each role's login file, which logs in inside the test
  runner; agents cannot read `.env`.
- **Re-runs are scoped.** Name an area, module or role to update only that part.
- **Context sync.** After a run, the executor hands it the suggestions you agreed to from
  `npm run context:sync`: a `verified: <TCID>, <date>` mark on a rule, a caveat naming an open defect, a known
  unknown answered. A test result never becomes, changes or removes a rule.

---

## 5. Test planning

![Test planning — one story to a plan, with seven STOP checkpoints and an optional plan review](diagrams/ai-qa-harness/05-test-planning.png)

`/playwright-test-planner <ISSUE-KEY>` turns one story into `specs/<ISSUE-KEY>.plan.md` and its CSV. Things to know
when you run it:

- **Git first.** It runs the story start protocol — `npm run story -- start`, with the base branch you pick —
  before anything else, or resumes the story's existing branch. See [Git workflow](#11-git-workflow).
- **The issue key is required.** Without one, it stops and asks; there is no key-less mode (I8).
- **No browser.** It grounds the plan in the repo: `context/`, the navigation plans, `pages/`, `data/`,
  existing specs.
- **Designs, if Figma is connected.** It reads the frames the story links, sparingly, as design intent — never
  as requirements. Each is cited in the plan's `**Design:**` line; a detail taken only from a design is marked
  `(design: <node>)`; a design that disagrees with an AC is raised at the first checkpoint.
- **Seven checkpoints:** story and gaps · conventions · reuse and scope · scenario titles · anything new ·
  the full plan · the CSV rows.
- **Optional review.** Before saving, it offers `playwright-test-reviewer` in plan-review mode and folds the
  `must fix` findings in; a clean review is recorded as `**Plan reviewed:**` in the plan.
- **It owns the test case IDs.** `<ISSUE-KEY>-TC<NNN>`, never renumbered; a dropped scenario is marked
  `Retired`.
- **Manual cases are tracked.** Each manual scenario gets a `Not Run` row in
  `specs/execution/manual-results.csv`.

---

## 6. Test generation

![Test generation — live browser drive, STOP gates for new page objects, SQL and the file path, then the test review](diagrams/ai-qa-harness/06-test-generation.png)

`/playwright-test-generator <plan>` turns an approved plan into a spec. Things to know when you run it:

- **It drives first.** `generator_setup_page` starts from the role's login file, every step runs live through
  the browser tools, and `generator_read_log` must show an action for each step before anything is written.
- **STOP gates:** a missing plan or test case ID · a new page object or method · SQL it does not have · the
  target file path.
- **File path.** `tests/stories/<release>/<ISSUE-KEY>.spec.ts`; with no release yet, the epic's folder or
  `tests/stories/`.
- **Review by default.** After writing, it starts `playwright-test-reviewer` in test-review mode, fixes every
  `must fix` (re-driving the step if needed), and re-reviews once. A clean review is recorded as
  `**Tests reviewed:**` in the plan — a story merges only once it is set.
- **Tags follow priority.** P1 and P2 get `@Regression` and `@Priority1`/`@Priority2`; P3 gets `@Priority3`;
  each test also gets a module tag from `specs/RegressionTags/regression-tags.md`.
- **Then it offers the run:** *run these tests now?* — a yes hands over to the executor.

---

## 7. Running tests

![Running tests — the executor's dry run, STOP to run, grouped failures to the healer, then defects, manual results, the report, context sync and the merge](diagrams/ai-qa-harness/07-running-tests.png)

`/playwright-test-executor` runs the tests and sees the run through. Things to know when you run it:

- **Two modes.** A *story run* — every test of the chosen stories — or a *regression run*: a release, or chosen
  epics or tickets, `@Regression` tests by default.
- **Dry run, then STOP.** `npm run regression -- … --dry-run` shows the tickets, test count, browsers and
  build without recording anything; it runs only on your yes, headless and in the foreground — a long run goes story by story.
- **Failures, once.** `npm run results:last` groups them by spec and error; you choose heal all, these groups,
  skip or stop, and it hands over to the healer with that scope.
- **Then, each offered:** the defect-raiser for pending defects · manual cases still Not Run · the reporter,
  with this run's scope · `npm run context:sync` for the context-builder · and, for a story, `npm run story --
  status`: *may merge* → finish, push and pull request, each asked; waiting → an `[on-hold]` commit.
- **Every figure comes from the scripts** — the dry run, `results:last`, the defect log, the manual results —
  read again after every hand-over.
- **It never** runs without your yes, fixes a test, files a bug, posts to Jira or reads `.env`.

---

## 8. Healing failures

![Healing failures — scope, run, debug, fix loop with the expected-value guard, or a confirmed defect](diagrams/ai-qa-harness/08-healing-failures.png)

`/playwright-test-healer` fixes failing tests and confirms genuine defects with you. Things to know when you
run it:

- **Name what to heal:** an issue key, a spec, a test case ID, or "what failed in the last run". If you name
  nothing, it lists the last run's failures from `test-results/results.json` and asks. The executor passes the
  groups you chose.
- **Test-side fixes are automatic:** selectors, waits and locator scope, in the page object or `testData.ts`,
  up to three attempts per test.
- **STOP gates:** what to heal · the expected-value guard (a fix that changes what a test expects needs the
  plan's backing or your yes) · after three attempts · confirming a defect and its severity.
- **Evidence is kept.** After you confirm a defect, it writes the entry as its own file,
  `specs/defects/log/<entry id>.json`, `pending`, and runs `npm run defect:evidence`, which copies the
  screenshots into `specs/defects/evidence/`.
- **Results are recorded.** It runs the healed specs once more with `npx playwright test`, and commits its
  fixes and defects (`test-heal(<KEY>)`, `defect(<KEY>)`).

---

## 9. Defects and retest

![Defects and retest — the defect-raiser files confirmed defects after one confirmation; the healer retests fixed ones](diagrams/ai-qa-harness/09-defects-and-retest.png)

`/playwright-defect-raiser` files the defects the healer logged. Things to know when you run it:

- **One confirmation.** It shows the batch — summary, severity, test case ID, story, evidence — and files only
  what you agree to.
- **Two modes.** With Jira tools, it searches for an open bug labelled with the test case ID, then creates the
  bug, links it to the story and attaches the evidence if the tools can upload. Without them, it appends rows to
  `specs/defects/defects.csv`.
- **Marking.** An automated test becomes `test.fixme(` with a defect comment; a manual case gets the key in
  `manual-results.csv`. The entry moves to `raised`, committed as `defect(<KEY>): … [defect-raised]`.

The retest is the healer again: it finds raised entries the tracker shows as done, or the ones you name, turns
`test.fixme(` back into `test(` and runs it twice. Passed both times → `verified`; otherwise the `fixme` is
restored. A manual case is re-executed by the tester. Before writing to Jira it stops: you choose a comment and
a transition from the bug's own workflow, or none.

---

## 10. Regression, reports and closure

![Regression, reports and closure — selection, STOP to run, recorded results, the formal report, and a person's decision to close](diagrams/ai-qa-harness/10-regression-reports-and-closure.png)

A release's regression runs on your machine — through `/playwright-test-executor` (say *regression for
2.26*), or `npm run regression` in a terminal. The formal report is `/playwright-test-reporter`'s. Things to
know:

- **In a terminal it asks:** which release (a number, several, `all`, or no release yet), which tickets (all, by
  epic, chosen), and whether to run only `@Regression` tests. The executor passes the answers as flags:
  `--release`, `--epics`, `--stories`, `--all-tests`, `--browser`, `--dry-run`, `--yes`.
- **STOP gates:** run it? before anything runs; at the end, a person decides whether the cycle closes.
- **Browsers.** It runs every browser project in `playwright.config.ts` unless you pass `--browser`.
- **The after-run report is automatic.** `lib/cycleReporter.ts` records each result in
  `specs/execution/automated-results.csv` and writes `reports/cycle-summary-release-<release>-….md` (local).
- **The formal report** — the reporter asks the scope (a story, several, an epic, a release) and the format
  (Markdown, HTML, PDF), adds Jira titles and status when connected, and writes
  `specs/execution/reports/QA-Report_<app>_<scope>` with `npm run report:cycle -- --formal`. One report per
  scope: a new one replaces the last, and git keeps the history. Every figure comes from the script; the agent
  writes only the summary. It offers a test-summary comment on each Jira story, asked first.
- **Whole cycle.** `npm run report:cycle -- --release <release> --since <date>` reports the latest result of
  every case since the cycle began, against the exit criteria in profile §10. `--closure` writes the final
  report to `specs/execution/closure/`.
- **Before you run it:** set `BUILD_UNDER_TEST` in `.env`, and retest defects reported fixed. A regression runs
  on `release/<release>` — the executor switches to it with `npm run story -- switch`.

---

## 11. Git workflow

![Git workflow — main, develop, release and story branches across one release cycle, the start protocol, the merge rule and the commit format](diagrams/ai-qa-harness/11-git-workflow.png)

Every story's work happens on its own branch. **The agents run git; you answer.** The full workflow is in
[docs/GIT-WORKFLOW.md](../GIT-WORKFLOW.md).

| Branch | Holds | Created from | Merges into |
|---|---|---|---|
| `main` | The tests for what is live | — | — |
| `develop` | Every finished story's tests | `main`, once | — |
| `release/<x>` | One client release's stories; its regression runs here | the latest `develop` | `main`, and back into `develop`, when the release closes |
| `test/<KEY>-<desc>` | One story | the freshly pulled `release/<x>`; `develop` with no release yet | its base, by pull request |
| `harness/<desc>` | A harness change, the improver's | `develop` | `develop` |

- **`npm run story`** — `status` works out each story's stage and whether it may merge from the files, every
  time; `start` runs the story start protocol (clean tree, fetch, resume an existing branch, the base you pick,
  a fast-forward pull); `switch`, `release-start`, `finish`. Without `--yes` each only shows what it would do;
  none pushes, merges into a shared branch, deletes a branch or rewrites history.
- **The merge rule:** a story merges once its tests are generated, reviewed and run — open defects and
  `test.fixme` included, so the release sees every known bug.
- **Commits** are one line: `<type>(<KEY>): <what> [<stage>]` — `test-plan`, `test-gen`, `test-review`,
  `test-run`, `test-heal`, `defect`, `test-manual`, `test-report`, `context`, `harness`.
- **Records merge cleanly.** The results CSVs merge with `merge=union`, and the scripts read the newest row per
  test case; each defect is its own file.
- **Protect `main`, `develop` and `release/*` on the remote.** The permission rules stop the usual destructive
  commands; branch protection holds whatever is typed.

---

## 12. Guardrails

![Guardrails — agent tool calls, the matching rule in .claude/settings.json, and its effect: BLOCK, ASK or ALLOW](diagrams/ai-qa-harness/12-guardrails.png)

The harness has no hook scripts. Its guardrails are permission rules in
[.claude/settings.json](../../.claude/settings.json), which Claude Code applies to every agent tool call: 98
`allow`, 25 `ask` and 96 `deny` rules. Every Jira and Figma rule is written for both connections — Jira's
`mcp__tracker__` and `mcp__plugin_atlassian_atlassian__`, Figma's `mcp__figma__` and
`mcp__plugin_figma_figma__`.

| Rule | Behaviour |
|---|---|
| `Read(./.env)`, `Read(./.mcp.json)` | **Blocks** — agents never see passwords or connection strings |
| Database write tools | **Blocks** `write_query`, `create_table`, `alter_table`, `drop_table`, `append_insight` |
| Jira deletes | **Blocks** issue, comment and attachment deletes, and `executeDestructive` |
| Jira admin and project tools | **Blocks** worklog, remote link, watch, sprint, version, board, entity property, hierarchy, project and screen changes |
| Destructive git | **Blocks** force-push, push `--delete`, `reset --hard`, branch delete, `rebase`, `commit --amend`, `filter-branch`, `filter-repo`, `clean`, `stash drop` / `clear` |
| Figma writes | **Blocks** every tool that writes to Figma — `use_figma`, `create_new_file`, the `generate_…` tools, uploads, Code Connect, plugin and shader writes, `send_prompt`, Weave runs |
| Jira writes | **Asks** before create, edit, transition, link, comment, attachment, `executeWrite`, `execute` |
| Git that reaches the remote or switches branch | **Asks** before `push`, `merge`, `pull`, `checkout`, `switch`, `mv`, `cherry-pick`, `gh pr create`, `gh pr merge` |
| Jira, database and Figma reads | Allowed without a prompt |
| The Playwright test server's tools the agents use | Allowed, so the context-builder, generator and healer keep their browser after the first checkpoint — the same tools their commands already grant, and `browser_resume`, which ends a paused debug run |
| Running one test: `npx playwright test` | Allowed, so the healer can re-run a test for its evidence and run a retest after the executor hands over |
| Starting the healer, defect-raiser, reporter and context-builder | Allowed, so the executor can hand a run over to each without a prompt |
| Local git and the harness scripts | Allowed: `git status` / `log` / `diff` / `show` / `fetch` / `add` / `commit -m`; `npm run story`, `env`, `check` (and `check:trace`, `check:docs`), `regression`, `results:last`, `report:cycle`, `context:sync`, `defect:evidence` |

The `allow` rules apply only after you accept Claude Code's trust dialog for the folder; `deny` and `ask` rules
apply always. To change a guardrail, edit `.claude/settings.json`; personal overrides go in `.claude/settings.local.json`,
which is gitignored. Rules match a Bash command by how it starts, so `git push origin x --force` would not
match `git push --force:*` — branch protection on the remote is the real guard for git.

Safeguards beyond the rules:

- Agents log in only through `tests/seeds/` and never handle a password (I4).
- `npm run env -- get <KEY>` gives agents only allow-listed, non-secret settings; passwords, emails, tokens and
  database settings are always refused.
- The healer's expected-value guard; the reviewer sub-agent limited to `Glob`, `Grep`, `Read`.
- `lib/globalSetup.ts` checks the application is reachable before every run.
- `config/DbConnection.ts` names missing settings before connecting and stops on refused logins.
- `npm run check` runs the typecheck, `check:docs` (including every setting the code reads being in
  `.env.example`) and `check:trace`.
- `npm run export` never overwrites; `.gitignore` keeps `.env` and `.mcp.json` out of git.
- The harness-improver never lowers the credential, database or delete protections.

---

## 13. Harness improvement

![Harness improvement — evidence, STOP, find the layer, propose, protection check, STOP, apply, record](diagrams/ai-qa-harness/13-harness-improvement.png)

`/playwright-harness-improver` changes a QA repo's own harness when it does not behave as the team needs. It
works on a `harness/<desc>` branch from `develop`.

1. **Get the evidence** — one real case: what the agent was given, what it did, what you expected.
2. **STOP** — you confirm the problem statement.
3. **Find the layer** — project facts, team conventions, agent instructions, invariants, scripts and config,
   guard rails, most specific first. A wrong fact is fixed as a fact.
4. **Propose the smallest change** — exact before and after, what else it touches, how to check it.
5. **Protections** — credential, database and Jira-delete protections never change; the others only on an
   explicit yes, recorded.
6. **STOP** — it waits for your yes.
7. **Apply** — the change, the docs that restate it, `npm run check`.
8. **Record** — an entry in [HARNESS-CHANGES.md](../../HARNESS-CHANGES.md): problem, cause, change, check,
   status, upstream, protections. It commits `harness: … [harness]` and offers a pull request into `develop`.

Its self-audit has 6 items, from "the problem was confirmed first" to "no claim the agent now behaves
differently". Two other modes: **Note** records a problem without changing anything; **Summarize** lists the
repo's changes and which are worth sending to the template.

---

## 14. Cross-cutting concepts

- **Issue keys and test case IDs.** Every story needs its issue key; each test case is `<ISSUE-KEY>-TC<NNN>`,
  starts its test's title, and links the acceptance criterion to the result, defect and Jira bug.
  `npm run check:trace` enforces it (I8).
- **Invariants.** [TEST-AUTHORING-INVARIANTS.md](../../TEST-AUTHORING-INVARIANTS.md) holds I1–I8: page objects,
  fixtures, test data, credentials, assertion values, environment config, locator uniqueness, traceability.
- **Roles and login files.** Each role key appears in `config/projectProfile.ts`, profile §2, `.env` as
  `<ROLE>_EMAIL` / `<ROLE>_PASSWORD`, and one login file in `tests/seeds/`.
- **Releases.** A plan's `**Release:**` is the client's release, and names its `release/<x>` branch. The
  harness's own version lives only in the template's `CHANGELOG.md`; each QA repo records the version it was
  copied from in profile §1.
- **Story status is computed, never stored.** `npm run story -- status` reads the plan, its review lines, the
  spec, the results and the defect log every time.
- **Numbers come from scripts.** The executor and the reporter quote what `results:last` and
  `report:cycle` print; no agent counts.
- **Records are committed.** Results, manual results, the defect log, evidence, formal reports and closure
  reports live in the QA repo, so the whole team works from one record.
- **Designs are intent, not rules.** A Figma frame guides a plan's wording and states; the acceptance criteria
  and `context/` decide.
- **Model and effort.** Every agent runs on `opus`, except the reporter on `sonnet`; the context-builder and
  planner use `effort: xhigh`.
- **Client-neutral template.** The template names no application; a project's copy holds its own names in the
  profile, `context/` and `data/`.

---

## 15. Which command do I use?

| I want to… | Run |
|---|---|
| Prepare the folder for a new QA repo (from the template) | `npm run prep -- <dir> --name "<project>"` |
| Copy the harness into a QA repo (from the template) | `npm run export -- <dir>` |
| Build a practice repo (from the template) | `npm run export -- <dir> --example <name>` |
| Teach the harness the application | `/playwright-context-builder` |
| See where each story is, and whether it may merge | `npm run story -- status` |
| Start or resume work on a story | `npm run story -- start <ISSUE-KEY>` — the planner runs it for you |
| Plan test cases for a story | `/playwright-test-planner <ISSUE-KEY>` |
| Generate tests from a plan | `/playwright-test-generator <plan>` |
| Review a plan or spec independently | `/playwright-test-reviewer` |
| Run a story's tests, or a release's regression | `/playwright-test-executor` |
| Fix failing tests | `/playwright-test-healer <ISSUE-KEY>` |
| File confirmed defects | `/playwright-defect-raiser` |
| Retest fixed defects | `/playwright-test-healer` — retest raised defects |
| Write the test report | `/playwright-test-reporter` |
| Change how the harness behaves | `/playwright-harness-improver` |
| Run a release's regression in a terminal | `npm run regression` |
| See the last run's failures, grouped | `npm run results:last` |
| See what a run confirmed in `context/` | `npm run context:sync` |
| Read a non-secret setting | `npm run env -- get <KEY>` |
| Run every `@Regression` test | `npm run test:regression` |
| Run the whole suite | `npm test` |
| Watch or step through tests | `npm run test:ui` · `npm run test:headed` · `npm run test:debug` |
| Run the API project | `npm run test:api` |
| Rebuild or close the cycle report | `npm run report:cycle` (`--release`, `--stories`, `--epics`, `--since`, `--closure`, `--formal`, `--format`) |
| Keep a defect's screenshots | `npm run defect:evidence` |
| Open the last HTML report | `npm run report` |
| Check the database connection | `npm run db:check` |
| Check types, docs and traceability | `npm run check` |
| Open the handbook | `npm run docs` |
| Install the browsers | `npm run setup` |

---

## Updating the diagrams

Edit [ai-qa-harness.drawio](diagrams/ai-qa-harness/ai-qa-harness.drawio) in draw.io desktop, or in VS Code with
the "Draw.io Integration" extension. Then export one PNG per page from `docs/harness-docs/diagrams/ai-qa-harness`:

```bash
DRAWIO="/c/Program Files/draw.io/draw.io.exe"   # a per-user install: "$LOCALAPPDATA/Programs/draw.io/draw.io.exe" · macOS: /Applications/draw.io.app/Contents/MacOS/draw.io · Linux: drawio
names=(01-architecture 02-agent-pattern 03-testing-lifecycle 04-context-builder-setup 05-test-planning
       06-test-generation 07-running-tests 08-healing-failures 09-defects-and-retest
       10-regression-reports-and-closure 11-git-workflow 12-guardrails 13-harness-improvement)
for i in "${!names[@]}"; do
  "$DRAWIO" -x -f png -p $((i + 1)) -s 1.5 -b 20 -o "${names[$i]}.png" ai-qa-harness.drawio
done
```

Update the diagrams and this guide whenever a harness change adds, renames or removes a command, agent,
guardrail rule or workflow step.

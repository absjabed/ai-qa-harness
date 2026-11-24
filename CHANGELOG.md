# Changelog

Changes to the **template**. Written for people maintaining a copy: each entry says what changed and
whether a copy should bother adopting it.

A copy diverges the moment it is configured — that is the intent, not a problem. This file exists so you
can tell which divergences are yours and which are just the template having moved on.

## How to use this

**When you copy the template**, `npm run export` records the version and commit you started from in
`PROJECT-PROFILE.md` section 1. Copying any other way, record them yourself:

```bash
git rev-parse --short HEAD    # run this in the template, at the commit you copied
```

**When you want to adopt an upstream change**, read the entries above your recorded version. Entries are
marked:

- **Adopt** — worth pulling into existing copies; usually a fix or a sharper agent prompt
- **Optional** — an improvement that depends on how you work
- **New copies only** — structural, and more trouble than it is worth to retrofit

There is no automatic update path, by decision: a copy diverges once configured, so adopting a change is a
person reading the entries and porting what is marked **Adopt**.

**When you improve the harness while working on a project**, the change belongs upstream only if it is
application-agnostic. Anything naming your application stays in your copy. Add an entry here when you push
it up.

## Versioning (template maintainers)

**The harness's version is the newest entry in this file — nowhere else.** No git tags, and not
`package.json`, whose version stays `0.0.0`. `npm run export` reads it from here and records it, with the
commit, in each copy's `PROJECT-PROFILE.md` section 1 as the *harness* version.

**It is never a project's version.** A project's releases are its client's — the `**Release:**` in each
plan and the `tests/stories/<release>/` folders, which regression and the cycle report run by. The two
numbers never share a field.

**1.0.0 was the pre-release baseline:** its changes were not listed — git history has them — and a copy made
from it is identified by the commit recorded in its profile. From 1.1.0 on, every change gets an entry at the
top of this file with a new version number, marked **Adopt**, **Optional** or **New copies only**.

---

## 1.1.0

Two agents that finish the cycle — one runs the tests and sees the run through, one writes the report — plus a
git workflow for a project's QA repo, designs from Figma, and context that a run can confirm. Nine agents now.

**For a copy on 1.0.0**, in order: the records changes first (they stop merge conflicts on their own), then
the agents you want. Each entry lists the files to port.

- **Records that merge cleanly** — **Adopt.** The results CSVs merge with `merge=union` and the scripts read the
  newest row per test case; each defect is its own file in `specs/defects/log/<entry id>.json` instead of one
  `defect-log.json`, so two branches recording defects never conflict. A copy's old `defect-log.json` is still
  read; `npm run defect:evidence` writes its entries out as files.
  Port: `.gitattributes`, `scripts/lib/defects.ts`, `scripts/lib/cycle.ts`, `scripts/defect-evidence.ts`, the
  healer's and defect-raiser's defect-log wording, `specs/defects/log/.gitkeep`.
- **`/playwright-test-executor`** — **Adopt.** Runs one story's tests or a release's regression, confirmed from a
  dry run first, headless in the background. Groups the failures and asks once — heal all, these, skip or stop
  — hands over to the healer, then offers the defect-raiser, the manual cases still Not Run, the report, the
  context sync and, for a story, the merge. Every figure comes from the scripts. The generator now asks *run
  these tests now?* after a clean review.
  Port: `agents/playwright-test-executor.md` and its wrapper, `scripts/last-run.ts` (`npm run results:last`),
  `scripts/regression.ts` (`--dry-run`, `--grep`, `--headless`, `--stories`/`--epics` without `--release`), the
  generator's hand-over.
- **`/playwright-test-reporter`** — **Adopt.** The formal test report for a story, several, an epic or a
  release, in Markdown, HTML or PDF, asked every time; one report per scope in `specs/execution/reports/`,
  replaced by the next. Verdict banner, headline figures, a status bar, details led by the story or release,
  exit criteria, results split automated and manual, sign-off. Jira titles and status when connected; a test
  summary comment on each story, asked first. The numbers come only from `npm run report:cycle`, which gains
  `--epics`, `--formal`, `--format`, `--by`, `--jira`, `--notes`, `--list`, `--defaults` and `--preview`.
  Port: `agents/playwright-test-reporter.md` and its wrapper, `scripts/cycle-report.ts`, `scripts/lib/cycle.ts`,
  `scripts/lib/report-render.ts`, `QA_TESTER_NAME` and `QA_REPORT_FORMAT` in `.env.example`, and `.gitignore`'s
  `/reports/` — anchored, because a bare `reports/` also ignores `specs/execution/reports/`; `npm run check`
  now fails when a records folder is ignored.
- **A git workflow** — **Optional**; your team's branch model may already be settled. `main`, `develop`,
  `release/<x>`, `test/<KEY>-<desc>` and `harness/<desc>` (`docs/GIT-WORKFLOW.md`). The agents run git and the
  tester answers: `npm run story` works out each story's status from the files, runs the story start protocol
  (clean tree, fetch, resume an existing branch, the base the person picks, a fast-forward pull), switches
  branches, creates release branches, and checks the merge rule — tests generated, reviewed and run, open
  defects included — before bringing the latest base in. Every agent commits its own stage:
  `<type>(<KEY>): <what> [<stage>]`. Plans gain `**Plan reviewed:**` and `**Tests reviewed:**`.
  `.claude/settings.json` allows local git, asks before a push, merge, pull, checkout or pull request, and
  denies force-pushes, hard resets, branch deletion and history rewrites.
  Port: `docs/GIT-WORKFLOW.md`, `scripts/story.ts`, `scripts/lib/trace.ts`, the plan template's two lines, the
  *Git* sections of the agents, the git rules in `.claude/settings.json`.
- **Settings read by key** — **Adopt.** `npm run env -- get <KEY>` gives agents allow-listed, non-secret
  settings without opening `.env`; `npm run check` fails when the code reads a setting `.env.example` does not
  list. Port: `scripts/env.js`, `scripts/check-docs.js`.
- **Agents keep their browser after the first checkpoint** — **Adopt.** A command's `allowed-tools` cover only
  the turn it starts, so once a tester answered a checkpoint every browser call asked again. The 25 Playwright
  test-server tools the commands already grant are now allowed in `.claude/settings.json`; nothing new is granted.
  `npm run check` and its parts (`check:trace`, `check:docs`) are allowed too, so the context-builder and planner
  can validate what they wrote before committing. Starting the healer, defect-raiser, reporter and
  context-builder is allowed, so the executor's hand-overs don't stop on a prompt; in a non-interactive session
  the executor runs the tests in the foreground, since a background run ends with the session.
  The setup docs now say to accept Claude Code's trust dialog: until a folder is trusted, none of its allow rules
  apply (deny and ask rules always do).
  The context-builder also stops at every checkpoint, reads nothing outside the repository unless named in its
  inventory, and marks each fact observed, read from source or assumed. Port: `.claude/settings.json`,
  `agents/playwright-context-builder.md`.
- **Planner keeps the plan honest after review** — **Adopt.** It applies a reviewer's `consider` only once you
  decide, re-runs its self-audit and shows every changed scenario in full. An Expected Result states what must
  hold for a pass, with no rationale in it; wording from a spec not yet seen in the app is asserted like any
  other. The CSV checkpoint shows a field-by-field comparison with the markdown. I4 now covers a test that
  switches role part-way. Port: `agents/playwright-test-planner.md`, `TEST-AUTHORING-INVARIANTS.md` (I4).
- **Generator: no credentials, no unreported gaps** — **Adopt.** It never fills a login form or reaches for
  credentials from any source, environment variables included; a role switch is a new seed session. It reads
  the log before each new session, reports a step it could not drive rather than calling it driven, and lists
  every plan line it cannot implement as written at its first checkpoint. Re-reviews get no author
  reasoning; step titles are the plan line verbatim. Every committing agent uses the one-line
  `git commit -m` form and never retries a refused call. Port: `agents/playwright-*.md`.
- **The run chain stays inside what you agreed** — **Adopt.** The healer never reroutes a refused test run
  through another runner, re-runs only tests it changed, commits a defect without the results file, and names
  any test case it cites as evidence with its plan title. The executor hands the reporter only the scope and
  your choices, and quotes `npm run story -- status` rather than git. The reporter writes its summary from the
  preview and the plan, and restates a scope you already chose instead of asking again. Context sync adds no
  `verified:` mark to a rule with an open defect, and moves answered unknowns out of `BASELINE.md`. The
  defect CSV's Reporter is the tester, as a tracker import needs a real user. Port: those five agents and the
  worked cycle's `defects.csv`.
- **Designs from Figma** — **Optional.** An optional `figma` MCP entry — Figma's remote server, signed in through
  the browser; the desktop app's server or the Figma plugin as alternatives. The planner and the
  context-builder read the frames a story links, sparingly, as cited design intent, never as rules; the
  reviewer never opens them. Read tools allowed, every Figma write denied, for both routes.
  Port: the `figma` entry in `.mcp.json.example`, the Figma rules in `.claude/settings.json`, the planner's
  *Designs* section and `**Design:**` plan line, the context-builder's preflight and *Design intent* steps,
  the reviewer's line, `docs/MCP.md`.
- **Context sync** — **Optional.** `npm run context:sync` links a run's test cases to the `context/` rules they
  verified or contradicted, and to the known unknowns they may answer, through the IDs their acceptance
  criteria cite. The executor offers the suggestions at the end of a run; the context-builder applies the
  ones agreed — `verified: <TCID>, <date>` marks, a caveat naming an open defect. A result never becomes,
  changes or removes a rule.
  Port: `scripts/context-sync.ts`, the context-builder's *Context sync* section, the template's *Design
  intent* section and verified-mark convention.
- **Documentation** — **Optional.** The developer guide gains running tests and the git workflow, with 13
  diagrams; the handbook, the walkthrough, the deck, `docs/AGENTS.md`, `docs/COMPONENTS.md`, `docs/MCP.md` and
  `docs/WORKFLOWS.md` cover the new agents and the workflow.
- **The practice example** — template only. The FleetKeep worked cycle gains a Vehicles context document
  its run verified.

---

## 1.0.0 — pre-release

A Playwright + TypeScript test harness driven by seven agents, application-agnostic by construction: every
project-specific value lives in `PROJECT-PROFILE.md`, `.env`, `.mcp.json` and `context/`.

**What it contains**

- **Seven agent definitions** in `agents/`, canonical and vendor-neutral. Claude Code wrappers in
  `.claude/commands/` carry no instructions, so they cannot drift. `agents/README.md` covers porting to
  another agentic tool.
  - `playwright-context-builder` — learns the application once at setup, writes the baseline the rest read;
    first checks every role can log in and the Jira connection works, and reports what to fix; re-run,
    scoped to one area, when it goes stale
  - `playwright-test-planner` — story to reviewed test plan, seven blocking checkpoints; fetches the story
    from Jira by its key when the tracker is connected
  - `playwright-test-generator` — plan to spec, driving the real browser first; has every spec reviewed
  - `playwright-test-reviewer` — an independent second reader in a fresh context: a plan against its ticket
    (offered by the planner), a spec against its plan (always, after the generator writes it). Read-only
  - `playwright-test-healer` — triages the failures of the story, spec or run it is pointed at, confirms
    genuine defects with a person — including ones a tester found by hand — keeps their screenshots, retests
    fixed ones and records the result on the bug
  - `playwright-defect-raiser` — files the confirmed defects you choose, after one confirmation: in the
    tracker, linked to the story with the evidence attached, or as a CSV
  - `playwright-harness-improver` — adapts a QA repo's harness when it does not behave as the team needs:
    traces the cause to the right layer, proposes the smallest change, applies it on a yes with the docs
    that restate it, never lowers a credential or data protection, and records every change in
    `HARNESS-CHANGES.md` with whether it is worth sending upstream
- **Eight authoring invariants** (I1–I8) in `TEST-AUTHORING-INVARIANTS.md`, cited by number. I8 is
  traceability: every story carries its issue key, every test case a `<STORY-KEY>-TC<NNN>` ID that starts
  its test's title and travels with any defect. `npm run check:trace` enforces it.
- **Testing-lifecycle coverage** — entry and exit criteria (`PROJECT-PROFILE.md` section 10), a readiness
  check before every run, test-data seeding, a committed execution record — each test case's latest
  automated result across runs, with the build under test, and the manual results — a committed defect log
  with its evidence, defect retest, and a cycle closure report written automatically as every run ends
  (`npm run report:cycle` rebuilds it by hand; `--closure` keeps the final one).
- **Regression per client release** — `npm run regression` asks for the release — or several, or all of
  them for the full regression — then all of its tickets,
  some epics, or chosen tickets, runs them, and reports on exactly that selection. Each plan records its
  release and epic — from Jira's fix version and parent epic when the tracker is connected.
- **A prep folder for setup day** — `npm run prep -- <dir> --name "<Project>"` makes the folder a project's QA
  repo will become: `setup/` files to fill in before setup day (start-here, filling guide, checklist, accounts
  and roles, Jira, decisions, contacts, paths — never passwords) and `context/sources/` subfolders for the
  documents. The export then goes into the same folder without touching them. Templates in `prep/`, never
  exported.
- **A practice example** — `examples/fleetkeep/`: a small fictional fleet-maintenance app with one planted
  defect, and layers that turn an export into a ready practice repo (`npm run export -- <dir> --example
  fleetkeep`, `--worked` for one ticket's finished cycle). Layers carry changes, not copies, and
  `check:docs` fails when a template change stops one applying. Never exported to a project.
- **A knowledge layer** — `context/` for distilled project knowledge, `PROJECT-PROFILE.md` for identity,
  `specs/UserFlowsUserRolePermissions/` for navigation and permissions.
- **The suite** — Page Factory fixtures, `BasePage` with an accessibility check, two wired page-object
  templates, a `cleanup` fixture, env-driven config that throws rather than defaulting, and a database
  connection for SQL Server or PostgreSQL that names missing configuration before dialling and fails fast
  on persistent refusals.
- **Agents never handle a password** — one login seed per role in `tests/seeds/`, which logs in inside the
  test runner.
- **Guard rails** — `.claude/settings.json` denies agents reading `.env` and `.mcp.json` and calling the
  database server's write tools, asks before any write to Jira — creating, editing, moving, commenting —
  and denies Jira deletes and admin tools. A bug's status is only ever moved to a transition the team's own
  Jira workflow offers, chosen by a person.
- **MCP servers** — Playwright (required), a database server (optional, read-only account), and Jira through
  whichever connection the team already has: the Atlassian plugin in Claude Code, or the MCP server entry.
- **Copying** — `npm run export -- <dir>` copies exactly the files a project needs, dotfiles included, and
  records where the copy came from.
- **Documentation** — a self-contained handbook at `docs/index.html` (`npm run docs`), component, agent,
  workflow and MCP references, and an introductory deck for QA teams at `docs/qa-harness-intro.html`.
  `npm run check:docs` catches the documentation drifting from the repository. Its link check skips
  `context/sources/`, whose documents are copied in from a team's wiki and link to pages that were not.

**Known limitations, stated plainly**

- Six of the seven agents are interactive by design. The suite runs on QA team members' own machines; there
  is no CI pipeline, and `npm run check` is run by hand before pushing.
- The documentation restates things the code owns, so it drifts. `npm run check:docs` catches the
  countable cases; the rest is habit.

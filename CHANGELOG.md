# Changelog

Changes to the **template**. Written for people maintaining a copy: each entry says what changed and
whether a copy should bother adopting it.

A copy diverges the moment it is configured — that is the intent, not a problem. This file exists so you
can tell which divergences are yours and which are just the template having moved on.

## How to use this

**When you copy the template**, record what you started from in `PROJECT-PROFILE.md` section 1:

```bash
git rev-parse --short HEAD    # run this in the copy, right after cloning
```

**When you want to adopt an upstream change**, read the entries above your recorded version. Entries are
marked:

- **Adopt** — worth pulling into existing copies; usually a fix or a sharper agent prompt
- **Optional** — an improvement that depends on how you work
- **New copies only** — structural, and more trouble than it is worth to retrofit

**When you improve the harness while working on a project**, the change belongs upstream only if it is
application-agnostic. Anything naming your application stays in your copy. Add an entry here when you push
it up.

---

## 1.1.1 — 2026-09-24

Setup fixes found while walking the setup path end to end, and a supported way to copy the harness into
a project's QA repository without taking the whole template.

**Adopt**

- **The context-builder's wrapper now carries the database-tools note** the healer's already had. Claude
  Code's `tools:` allow-list withheld a wired database server's tools from it, so it silently skipped schema
  introspection. If your copy wires a database, add that server's read-only tool names to both
  `.claude/commands/playwright-context-builder.md` and `.claude/commands/playwright-test-healer.md`.
- **Setup step 2 says so.** The need to name the tools was recorded only inside the healer wrapper, so
  someone following `SETUP.md` would wire the database and see nothing change. Now covered in `SETUP.md`,
  `docs/MCP.md`, `agents/README.md` and the handbook, with a troubleshooting entry.

- **`check:docs` knows the template from a copy**, by the `name` in `package.json`. In a copy it no longer
  runs the vendor-neutrality check — which failed any copy the moment it named its own application — or
  directory coverage. Take the new `scripts/check-docs.js`, and make sure your copy's package name is not
  `ai-qa-harness`.
- **`check:docs` asserts `.gitignore` keeps out `.env` and `.mcp.json`**, and runs in a copy that has not
  been through `git init` yet.

**New copies only**

- **`npm run export -- <dir>`** copies the harness into a project's QA repository: every tracked file except
  `README.md`, `CHANGELOG.md` and the script itself, dotfiles included. It names the package, writes a starter
  README, records the template version and commit, and verifies the copy. Never overwrites. `SETUP.md` step 0
  now leads with it, and lists what a hand copy must not miss.

**Optional**

- **What to prepare before running the context-builder** — a checklist in `SETUP.md` step 3 and the
  handbook: what must be in place, what is worth gathering, what to decide. Includes one thing easy to miss:
  the role keys in profile section 2 must exist before it runs, since it logs in as each role listed there.
  And one security note: the agent reads passwords from `.env` to log in, so use dedicated test accounts.
- **`docs/AGENTS.md` gains a context-builder section** — the reference previously covered only four of the
  five agents.
- Two places said fewer agents need a browser than do; three of the five do.

## 1.1.0 — 2026-09-24

Closes the gaps in how the harness covers the software testing life cycle, and makes traceability from
acceptance criterion to defect a rule rather than a hope.

**Adopt**

- **I8 — Traceability**, a new invariant. Every story needs its issue key (a Jira key, for example); the
  planner stops and asks when one is missing, with no key-less fallback. TCIDs are
  `<STORY-KEY>-TC<NNN>`, assigned only in the plan, never renumbered or reused — dropped cases are marked
  `Retired`. Every story test's title starts with its TCID. Previously the generator named tests "after the
  scenario" and its own example dropped the ID, which broke the chain at the test.
- **`npm run check:trace`** enforces the mechanical parts, and now runs in CI.
- **The healer retests fixed defects** — un-`fixme`s the test, runs it twice, and marks the log entry
  `verified` or restores the `fixme`. Previously a fixed defect's test stayed skipped indefinitely.
- **Defects carry `tcid` and `storyKey`**, in the log, the tracker CSV's labels and description, and the
  `fixme` comment. An entry that cannot be traced is left `pending` rather than filed.
- **The healer can adjudicate DB-backed failures** when a read-only database MCP server is wired.

**Adopt, with care**

- **A readiness check runs before every test run** (`lib/globalSetup.ts`): the application must answer at
  `BASE_URL`, and the database must be reachable if DB validation is in scope. A copy with no database that
  never set `DB_VALIDATION_ENABLED=false` will now stop at this check rather than failing test by test — set
  it. `SKIP_READINESS_CHECK=true` bypasses it.
- **`PROJECT-PROFILE.md` gains section 10, Test strategy** — test types in scope, entry and exit criteria.
  The setup checklist moves from section 10 to section 11; update any reference to it.

**Optional**

- **`npm run report:cycle`** — the test-cycle closure report: outcomes, pass rates by priority,
  acceptance-criteria coverage, open defects, traceability gaps, exit criteria evaluated. `--strict` gates.
- **Manual execution log** at `specs/execution/manual-results.csv`, seeded by the planner.
- **`data/seed.ts`** and the **`cleanup` fixture**, for putting test data into a known state and removing
  what a test creates.
- **Accessibility** — `BasePage.expectNoAccessibilityViolations()`, via `@axe-core/playwright`.
- **`regression.yml`** — an opt-in workflow that runs the suite and the closure report.

**Also**

- The example issue key in `PROJECT-PROFILE.md` is now `PROJ`, a neutral placeholder.
- The handbook gains a *Testing lifecycle* section.

---

## 1.0.0 — 2026-09-23

First released version of the template.

A Playwright + TypeScript test harness driven by five agents, application-agnostic by construction: every
project-specific value lives in `PROJECT-PROFILE.md`, `.env`, `.mcp.json` and `context/`.

**What it contains**

- **Five agent definitions** in `agents/`, canonical and vendor-neutral. Claude Code wrappers in
  `.claude/commands/` carry no instructions, so they cannot drift. `agents/README.md` covers porting to
  another agentic tool.
  - `playwright-context-builder` — learns the application, writes the baseline the rest read
  - `playwright-test-planner` — story to reviewed test plan, seven blocking checkpoints
  - `playwright-test-generator` — plan to spec, driving the real browser first
  - `playwright-test-healer` — triages failures, confirms genuine defects with a person
  - `playwright-defect-raiser` — files confirmed defects, unattended
- **Seven authoring invariants** (I1–I7) in `TEST-AUTHORING-INVARIANTS.md`, cited by number from the three
  authoring agents so a convention has one place to change.
- **A knowledge layer** — `context/` for distilled project knowledge, `PROJECT-PROFILE.md` for identity,
  `specs/UserFlowsUserRolePermissions/` for navigation and permissions.
- **The suite itself** — Page Factory fixtures, `BasePage`, two wired page-object templates, env-driven
  config that throws rather than defaulting, and a SQL Server connection that names missing configuration
  before dialling and fails fast on persistent refusals.
- **Documentation** — a self-contained handbook at `docs/index.html` (`npm run docs`), plus component,
  agent, workflow and MCP references.

**Known limitations, stated plainly**

- Nothing in this template has been exercised against a real application. It compiles, its tests collect,
  its guards produce the right messages — but no agent has been observed running end to end. Treat the
  first project as the real test of it.
- Four of the five agents are interactive by design and are not CI-shaped on any vendor.
- The documentation restates things the code owns, so it drifts. `npm run check:docs` catches the
  countable cases; the rest is habit.

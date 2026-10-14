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

## Releasing (template maintainers)

Every release is a git tag, `v<version>`, so a copy can say exactly what it started from.

1. Add the entry at the top of this file and set `version` in `package.json` to match — `npm run check:docs`
   fails until the two agree.
2. `npm run check`.
3. Commit, then tag and push both:

   ```bash
   git tag -a v1.2.0 -m "1.2.0"
   git push origin main v1.2.0
   ```

4. Copies come from a tag: `git checkout v1.2.0`, then `npm run export -- <dir>`. Exporting from anywhere
   else works, but the copy records the version as *unreleased*.

Copies have no automatic update path, by decision: a copy diverges once configured, so adopting an upstream
change is a person reading the entries above their recorded version and porting what is marked **Adopt**.

---

## 1.2.0 — 2026-10-14

PostgreSQL support, Jira over MCP, agents that never handle a password, permission guard rails, and release
tags. Also a correction to 1.1.1.

**Adopt**

- **Correction: 1.1.1's "name the database tools or the agents cannot see them" was wrong.** The wrappers are
  Claude Code *commands*, and commands do not support a `tools:` field — it was silently ignored, so it never
  restricted anything and naming tools there did nothing. Nothing was ever withheld. The wrappers now use
  `allowed-tools`, which commands do support; it *pre-approves* the listed tools so they run without a
  prompt, and restricts nothing. `name:` and `color:`, also ignored by commands, are gone. Take the new
  `.claude/commands/*.md`, and drop any tool names you added to `tools:` lines after 1.1.1.
- **Guard rails in `.claude/settings.json`**, the restrictions the wrappers never actually provided. Denied:
  reading `.env` and `.mcp.json`; the database server's write tools; Jira edits, status changes, deletes,
  admin tools and the server's generic `execute`. Asked every time: creating, linking, commenting on or
  attaching to a Jira issue. Allowed without a prompt: the read-only database and Jira tools.
  `.claude/settings.local.json` is now gitignored for personal overrides.
- **Agents never handle a password.** New `tests/seeds/<role>.spec.ts`, one per role: each logs in inside the
  test runner, and agents start from the signed-in page it leaves. The context-builder and generator now
  always name a seed instead of logging in by hand or reading `.env` — which the guard rails deny. Add one
  seed per role in your copy; `npm run check:docs` fails while a role has none. Before running the
  context-builder, the login must work: `npx playwright test tests/seeds/` (SETUP.md step 3).
- **Role seeds are kept out of the "seed" fallback.** Playwright, given no seed, picks the first test file
  with "seed" in its name; the role seeds are named `<role>.spec.ts` so that fallback stays the signed-out
  `tests/seed.spec.ts`.

**Optional**

- **PostgreSQL.** `DB_ENGINE=postgres` in `.env`; SQL Server stays the default. `config/DbConnection.ts`
  now sits on one adapter per engine in `config/db/`, each loading its driver only when used, each with its
  own plain-language failure advice — `pg_hba.conf` and managed-server firewalls, TLS mismatches, missing
  databases. Parameters are written `@name` on both engines. Queries return `{ rows, rowCount }`;
  `recordset` remains as the same array, so existing page objects keep working. New `.env` keys:
  `DB_ENGINE`, `DB_ENCRYPT`, `DB_TRUST_SERVER_CERTIFICATE`; `DB_PORT` and `DB_SCHEMA_PREFIX` now default
  per engine. Tested against a real PostgreSQL 16: queries, parameters, row counts, the refusal latch,
  and each failure message.
- **Database MCP server example**: `@executeautomation/database-server`, which serves PostgreSQL and SQL
  Server, version-pinned. It has no read-only mode — the account and the deny rules are the guard.
- **Jira over MCP** — Atlassian's remote server, `https://mcp.atlassian.com/v2/mcp?tools=all`, under the
  key `tracker`. The planner fetches a story from its key and asks you to confirm it is complete. The
  defect-raiser creates the bugs — searching first for an open one with the same TCID, showing the batch,
  and asking once — links them to the story, and fills `trackerKey`; without a tracker it writes the CSV as
  before. The healer finds which raised bugs are fixed from their status, and offers to comment the retest
  result. No agent edits, moves or closes an issue.
- **Release tags.** `v1.0.0` to `v1.1.2` tagged retroactively on the last commit at each version; releases
  are tagged from now on. `npm run export` records whether the copy came from a release tag, and
  `check:docs` fails when `package.json` and this file disagree on the version. See *Releasing* above.

**Not yet verified**: the tracker integration and the guard rails are written to Atlassian's and Claude
Code's documentation, but have not been exercised against a live Jira site.


## 1.1.2 — 2026-09-24

When to run the context-builder, stated plainly.

**Adopt**

- **Scoped runs** — `agents/playwright-context-builder.md` gains a section: name an area, module or role and
  it runs for that alone, updating only that part of the baseline. `SETUP.md` already told people to run it
  "for that area"; the agent had not been told how.

**Optional**

- **Cadence documented** — once at setup, not per story; again only when its knowledge goes stale, including
  when the other agents keep asking about one area. New workflow 11 in `docs/WORKFLOWS.md`; the handbook,
  `SETUP.md` and `docs/AGENTS.md` updated to match.

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

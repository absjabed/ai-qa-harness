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

**For now it stays 1.0.0, pre-release,** until the harness has been set up and used by a real project's QA
team: changes are not listed here — git history has them — and a copy is identified by the commit recorded
in its profile. After that first real use, every change gets an entry at the top of this file with a new
version number, marked **Adopt**, **Optional** or **New copies only**.

---

## 1.0.0 — pre-release

A Playwright + TypeScript test harness driven by six agents, application-agnostic by construction: every
project-specific value lives in `PROJECT-PROFILE.md`, `.env`, `.mcp.json` and `context/`.

**What it contains**

- **Six agent definitions** in `agents/`, canonical and vendor-neutral. Claude Code wrappers in
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
  `npm run check:docs` catches the documentation drifting from the repository.

**Known limitations, stated plainly**

- Nothing in this template has been exercised against a real application. It compiles, its tests collect,
  its guards produce the right messages, and its PostgreSQL path has been tested against a real server —
  but no agent has been observed running end to end, and the Jira integration and permission rules have not
  been exercised against a live Jira site. Treat the first project as the real test of it.
- Five of the six agents are interactive by design. The suite runs on QA team members' own machines; there
  is no CI pipeline, and `npm run check` is run by hand before pushing.
- The documentation restates things the code owns, so it drifts. `npm run check:docs` catches the
  countable cases; the rest is habit.

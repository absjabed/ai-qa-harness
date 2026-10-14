# Starting a new QA repository

The step-by-step for the usual case: a project gets its **own, new QA repository**, the harness's files are
copied into it, and all configuration happens **there**. This repository — the harness template — is never
cloned for a project and never configured. It stays clean so the next project can start from it too.

```
  ai-qa-harness (this repo)                     <project>-qa (the new repo)
  ──────────────────────────                    ───────────────────────────
  the template — never configured   ── copy ──▶ the project's QA suite
  stays application-neutral                     configured, tests written, regression run
```

[SETUP.md](../SETUP.md) has the reasoning behind each piece. This guide is the order to do them in.

---

## 1. Create the new repo and copy the harness into it

**1. Create the QA repository** wherever your team keeps repositories, and clone it to your machine — or
just make an empty folder and `git init` it later. It can already contain a README; nothing else should be
in it yet.

**2. Copy the harness in.** From a checkout of this template — no `npm install` needed here:

```bash
npm run export -- <path-to-the-new-repo>
```

For example `npm run export -- ../acme-qa`, or a full path such as `E:\work\acme-qa`. This does not clone
anything, and brings no git history. It copies the files listed below — dotfiles included, which a copy by
hand tends to miss — and then:

- names the package after the folder;
- writes a starter `README.md`, unless the repo already has one;
- records the **harness version and commit** in the copy's `PROJECT-PROFILE.md` section 1 — the harness's
  own version, never your project's release numbers;
- checks the copy for missing files.

It never overwrites anything, so it is safe to run against a repo that already has a README.

### What gets copied

Everything below. **Copy all of it, even what you may not need** — the files refer to each other, and the
consistency check fails when one is missing. Trim what you do not use later, in [SETUP.md](../SETUP.md)
step 9, which says what to edit when you remove something.

| Folder / file | What it is | In the new repo you… |
|---|---|---|
| `.claude/commands/` (5 files) | The five agents' Claude Code commands | leave as they are |
| `.claude/settings.json` | Guard rails — what agents may never do | leave, unless you rename an MCP server |
| `.env.example` | Every setting the suite reads, labelled required/optional | copy to `.env` and fill in |
| `.mcp.json.example` | Browser, database and Jira connections for the agents | copy to `.mcp.json` and fill in |
| `.gitignore`, `.gitattributes` | Keep `.env`, `.mcp.json` and results out of git | leave — **never skip `.gitignore`** |
| `PROJECT-PROFILE.md` | The project's identity: roles, vocabulary, modules, strategy | fill in |
| `SETUP.md`, `TEST-AUTHORING-INVARIANTS.md` | The setup reference, and the eight test rules | read |
| `agents/` (6 files) | The agent definitions | leave |
| `config/` (`projectProfile.ts`, `testConfig.ts`, `DbConnection.ts`, `testDbConnection.ts`, `db/` ×3) | Settings and the database connection | set the roles in `projectProfile.ts` |
| `context/` (3 files) | Where the context-builder writes what it learns | review what it writes |
| `data/` (`auth_data.ts`, `testData.ts`, `sql_queries.ts`, `seed.ts`) | Credentials lookup, test data, queries, data seeding | fill in as you go |
| `docs/` (7 files) | The handbook, references, this guide, the team deck | read |
| `lib/` (`BaseTest.ts`, `globalSetup.ts`, `cycleReporter.ts`, `api/ApiClient.ts`) | Fixtures, readiness check, the after-run report, the API client | add a fixture per page object |
| `pages/` (`BasePage.ts`, `LoginPage.ts`, `DashboardPage.ts`, `common/` ×2) | Page objects | replace the `CHANGE_ME` selectors |
| `scripts/` (`check-docs.js`, `check-trace.ts`, `cycle-report.ts`, `regression.ts`, `open-docs.js`, `lib/` ×2) | Checks, regression, the cycle report | leave |
| `specs/` (plan templates, navigation-flow templates, coverage patterns, regression tags, manual results) | Plans and the knowledge the agents read | the agents fill most of it |
| `tests/` (`seed.spec.ts`, `seeds/` ×3, `example.spec.ts`, `common/login.ts`, `stories/.gitkeep`) | Starting points, one login per role, a reference test | one login file per role |
| `package.json`, `package-lock.json`, `tsconfig.json`, `playwright.config.ts` | The project's tooling | leave |

### What is not copied

| Not copied | Why |
|---|---|
| `README.md` | It describes the template; the copy gets its own |
| `CHANGELOG.md` | The template's history; the copy records the version it came from instead |
| `scripts/export-harness.js` | A copy has nothing to export |
| `.env`, `.mcp.json` | They hold passwords — each project creates its own from the `.example` files |
| `node_modules/`, `test-results/`, `playwright-report/`, `reports/` | Installed or generated |

### Copying by hand instead

If you cannot run the export, copy exactly the files above — `git ls-files` in the template lists them —
then do the two things it would have done:

1. In `package.json`, change `name` from `ai-qa-harness` to your project's. Until you do, the consistency
   check treats the copy as the template and fails as soon as your application's name appears in a file.
2. In `PROJECT-PROFILE.md` section 1, fill in the harness version — the newest entry in the template's
   `CHANGELOG.md` — and the template's commit, from `git rev-parse --short HEAD`.

**3. Install**, now inside the new repo:

```bash
npm install
npx playwright install
```

**4. First commit.** Before it, run `git status` and confirm neither `.env` nor `.mcp.json` is listed. They
are gitignored; if either appears, `.gitignore` was not copied.

---

## 2. Configure the minimum

All in the new repo. This is only what the context-builder needs; the rest comes after it.

1. **`.env`** — `cp .env.example .env`, then fill the keys marked REQUIRED: `APP_NAME`, `TRACKER_PROJECT_KEY`,
   `BASE_URL`, and one `<ROLE>_EMAIL` / `<ROLE>_PASSWORD` pair per role. Database and API keys only if those
   are in scope.
2. **Roles** — the same role keys in three places: the `roles` array in `config/projectProfile.ts`, the *Role
   key* column of `PROJECT-PROFILE.md` section 2 (and name the baseline, full-access role), and the env var
   pairs above (`caseWorker` → `CASE_WORKER_EMAIL`).
3. **One login file per role** — `tests/seeds/<role>.spec.ts`. Three ship, for the example roles; copy one per
   real role, rename it to the role key, change the role inside, and delete the ones you do not use.
   `npm run check` fails until every role has one.
4. **The login page** — replace the `CHANGE_ME` selectors in `pages/LoginPage.ts` (username, password,
   submit) and the logged-in check in `pages/DashboardPage.ts`. To find them, open the app in Playwright's
   recorder and click the fields:

   ```bash
   npx playwright codegen <BASE_URL>
   ```

5. **`.mcp.json`** — `cp .mcp.json.example .mcp.json`. Keep `playwright-test`. Fill in `database` with a
   **read-only** QA account, or delete it. For Jira: in Claude Code, install the Atlassian plugin and delete
   the `tracker` entry; with another tool, keep `tracker`. If there is no Jira connection, delete it.
6. **Open Claude Code in the new repo's folder** — that is where it picks up the agents, the guard rails and
   the MCP servers. The first time, it asks you to approve the servers in the project's `.mcp.json` — approve
   them. Then run `/mcp`: `playwright-test` must show connected; sign in to Jira there if you use it.

---

## 3. Checklist before running `/playwright-context-builder`

**Must be done** — without these it cannot work:

- [ ] Harness copied in, `npm install` and `npx playwright install` run
- [ ] The QA environment opens in a browser from this machine — VPN on if needed — and is not mid-deploy
- [ ] `.env` has `APP_NAME`, `TRACKER_PROJECT_KEY`, `BASE_URL`
- [ ] Role keys match in `config/projectProfile.ts` and `PROJECT-PROFILE.md` section 2, baseline role named
- [ ] One credential pair per role in `.env` — **dedicated QA test accounts**, never a person's own, never one
      that works in production
- [ ] One login file per role in `tests/seeds/`
- [ ] Login selectors filled in `pages/LoginPage.ts`, logged-in check in `pages/DashboardPage.ts`
- [ ] `.mcp.json` created; `/mcp` shows `playwright-test` connected
- [ ] `npm run check` passes

**Worth having** — each one widens what it can learn; none is required:

- [ ] Database: a read-only QA account, filled into `.mcp.json`
- [ ] Jira connected and signed in, and **one story key you know exists**, so it can test the connection
- [ ] Local paths to the application source, OpenAPI/Swagger file, schema scripts, integration contracts,
      exported requirement or wiki pages
- [ ] Who to ask about which area

**Decided before starting:**

- [ ] Which environment — QA or staging, never production
- [ ] Areas it must stay out of — anything out of scope, or where even opening a screen has an effect
- [ ] The people testing in that environment know someone is exploring it
- [ ] Someone stays with it: it stops at every checkpoint and waits for an answer

You do **not** need to test the logins yourself first — the agent's first step does that and tells you what
to fix. `npx playwright test tests/seeds/` runs the same check by hand.

---

## 4. What the context-builder does — and yes, it roams the application

Walking the application page by page is the **main part** of its job. In order:

| Step | What it does | You |
|---|---|---|
| **0. Preflight** | Runs every role's login file and reports per role: passed, or what to fix — a variable missing from `.env`, a selector still `CHANGE_ME`, an account rejected. Says which Jira connection it found, and fetches your known story to prove it works. | fix what it reports; confirm |
| **1. Inventory** | Asks which sources exist and which it can reach — app, database, source code, API docs, contracts, requirement docs, people. Checks it can read each local path. | answer; correct |
| **2. Roam** | **Signed out**, it looks at the login screen, password reset and any public pages. Then **as each role** — starting from that role's login file, so it begins already signed in — it clicks through the application page to page: the menus and top-level areas, each screen it can reach, what that role can do there, what is missing or disabled compared with the full-access role, and the click path to every area. It records the labels the UI uses. | confirm the module map and the role differences |
| **3. Read** | Reads the local sources you confirmed — source code for validation rules and states, API docs, contracts. | — |
| **4. Introspect** | If a database is connected: reads the schema for the areas it mapped, read-only, and confirms anything surprising against real rows. | — |
| **5. Write** | Drafts `context/BASELINE.md`, `PROJECT-PROFILE.md` sections 2–4, one navigation plan per role, the cross-role permission matrix, and the module tag table — showing each before writing. | review the drafts |

**What it never does while roaming:**

- **Type a password.** The login file signs in inside the test runner; the agent is handed a signed-in
  page. It is also denied reading `.env`.
- **Change anything.** No form submitted, no record created or deleted, no setting changed — not even on the
  login screen. It is mapping an environment other people test in. If understanding an area needs an action,
  it stops and asks.
- **Guess.** What it could not reach or confirm goes into the baseline's *known unknowns*, which makes the
  other agents ask instead of assume.
- **Write tests.** That is the planner's and generator's job, per story, later.

It runs once at setup. Run it again only when the application changes — a new module or role, changed
navigation or permissions — and name the area to re-walk just that part.

---

## 5. Then

1. Review what it drafted: `PROJECT-PROFILE.md` sections 2–4 ([SETUP.md](../SETUP.md) step 4), the
   navigation plans (step 7) and the module tags (step 8).
2. Finish the rest of [SETUP.md](../SETUP.md): page objects (5), test data (6), trimming what you do not use
   (9), and the final check (10).
3. Your first story: give `/playwright-test-planner` its Jira key — [WORKFLOWS.md](WORKFLOWS.md) workflow 1.

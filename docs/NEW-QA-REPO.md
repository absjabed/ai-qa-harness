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

## 2. Configure the minimum — exact values

All in the new repo. This is only what the context-builder needs; everything else comes after it.

### 2a. `.env`

`cp .env.example .env`, then fill these. Every other key is optional or only needed for a feature you turn on;
`.env.example` labels each one.

| Key | What it is | Example | Where to find it |
|---|---|---|---|
| `APP_NAME` | The application's name, as it should appear in report titles. Any text. | `Acme Portal` | — |
| `TRACKER_PROJECT_KEY` | Your **Jira project key**: the letters in front of the dash in every ticket ID. Tickets `ACME-1234`, `ACME-1250` → the key is `ACME`. Bugs are filed into this project. | `ACME` | Read it off any ticket ID, or Jira → *Project settings* → *Details* → *Key* |
| `BASE_URL` | The QA environment's address — scheme included, no trailing slash. The login screen should be at this address, or redirect from it. | `https://qa.acme.example` | Your QA environment |
| `<ROLE>_EMAIL` / `<ROLE>_PASSWORD` | One pair per role (2b): the username the login form takes — an email or a plain username — and its password. | `ADMIN_EMAIL=qa.admin@acme.example` | Your QA test accounts |

Use **dedicated QA test accounts** — never a person's own account, never one that also works in production.
Agents never see these values: the login files read them inside the test runner, and agents are denied
reading `.env`.

Also put the same project key's ticket format into `PROJECT-PROFILE.md` section 1 (*Issue key format*:
`ACME-1234`), and tighten `storyKeyPattern` in `config/projectProfile.ts` to it — `/^ACME-\d+$/` — so a
mistyped key is caught.

### 2b. Role keys — or let the context-builder set them up

**The context-builder can do 2b and 2c for you.** Its first step shows the roles it finds, asks which kinds
of user your application really has, and — once you agree — writes the role keys, creates one login file per
role, and tells you the exact `.env` names to fill in. To do it yourself instead, read on.

A **role key** is a short name you choose for each *kind* of user that logs in — one per distinct set of
permissions your tests need, not one per person. Write it in camelCase: letters and digits, starting with a
lowercase letter, no spaces. For example:

| Application | Role keys |
|---|---|
| An HR system | `admin`, `hrManager`, `employee` |
| An online store | `storeAdmin`, `warehouseStaff`, `customer` |
| A case-management system | `supervisor`, `caseWorker`, `auditor` (read-only) |
| A banking back office | `opsAdmin`, `teller`, `branchManager`, `complianceViewer` |

The same key appears in four places. For roles `admin` and `caseWorker`:

| Where | What to write |
|---|---|
| `config/projectProfile.ts` | `export const roles = ['admin', 'caseWorker'] as const;` — and `baselineRole: 'admin'`, the full-access role the others are compared against |
| `PROJECT-PROFILE.md` section 2 | One row per role, the key in the *Role key* column; set *Baseline role* to `admin` |
| `.env` | The key in capitals, a `_` where a capital letter starts a word: `admin` → `ADMIN_EMAIL`, `ADMIN_PASSWORD`; `caseWorker` → `CASE_WORKER_EMAIL`, `CASE_WORKER_PASSWORD` |
| `tests/seeds/` | One login file per role, named after the key: `admin.spec.ts`, `caseWorker.spec.ts` (2c) |

Remove the example roles you do not have — from all four places.

### 2c. One login file per role

Each file in `tests/seeds/` logs in as one role. Agents start from it whenever they need to be signed in, so
they never handle a password. Three ship, for the example roles `admin`, `standardUser` and `readOnlyUser`;
each opens with these instructions and examples.

For an online store with roles `storeAdmin`, `warehouseStaff` and `customer`, the folder ends up as:

```
tests/seeds/
  storeAdmin.spec.ts        test('start as storeAdmin', …  testUsers.storeAdmin
  warehouseStaff.spec.ts    test('start as warehouseStaff', …  testUsers.warehouseStaff
  customer.spec.ts          test('start as customer', …  testUsers.customer
```

For each real role:

1. Copy `tests/seeds/admin.spec.ts` to `tests/seeds/<role key>.spec.ts`.
2. In the copy, change the role in **two** places — the test's title and the credential it uses:

   ```ts
   test('start as caseWorker', async ({ loginPage, dashboardPage }) => {
       await userLogin(loginPage, dashboardPage, testUsers.caseWorker);
   });
   ```

3. Delete the shipped files for roles you do not have.

Keep each file to the login — nothing else. Do not put "seed" in the filename. `npm run check` fails if a role
has no login file, or a login file has no role.

### 2d. The login page — the context-builder can do this for you

The login files work once `pages/LoginPage.ts` points at the real login screen. Four things need to match the
application:

| In | Replace | With the real |
|---|---|---|
| `pages/LoginPage.ts` | `usernameInput` — `getByLabel('CHANGE_ME_Email')` | username or email field |
| `pages/LoginPage.ts` | `passwordInput` — `getByLabel('CHANGE_ME_Password')` | password field |
| `pages/LoginPage.ts` | `submitButton` — `getByRole('button', { name: 'CHANGE_ME_Log in' })` | sign-in button |
| `pages/DashboardPage.ts` | `heading` — the element that proves the login worked | something only visible once signed in — a heading, the account menu |

If the login screen is not at the root of `BASE_URL`, also change `open()` in `LoginPage.ts` — `goto('/login')`.

Three ways to fill them — pick one:

- **Let the context-builder do it.** Leave them as `CHANGE_ME`. Its first step finds the login failing, opens
  the login screen — which needs no login — reads the fields, proposes the exact change, and edits the file
  once you agree. Then it does the same for the logged-in check. Nobody runs anything by hand.
- **Record them yourself** with Playwright's recorder: `npx playwright codegen <BASE_URL>` opens a browser
  window **on your screen**; click each field and copy the locator it shows. This one needs a person — it is
  an interactive window, not something an agent can drive.
- **Write them by hand** from the labels you see on the screen: `getByLabel('Email address')`,
  `getByRole('button', { name: 'Sign in' })`.

### 2e. `.mcp.json` and Claude Code

1. `cp .mcp.json.example .mcp.json`. Keep `playwright-test`. Fill in `database` with a **read-only** QA
   account, or delete it. For Jira: in Claude Code, install the Atlassian plugin and delete the `tracker`
   entry; with another tool, keep `tracker`. No Jira connection → delete it.
2. **Open Claude Code in the new repo's folder** — that is where it picks up the agents, the guard rails and
   the MCP servers. The first time, it asks you to approve the project's servers — approve them. Then run
   `/mcp`: `playwright-test` must show connected; sign in to Jira there if you use it.

---

## 3. Bring the project's existing knowledge

The context-builder learns far more from what your team already has than from the application alone. Gather
what exists before it runs:

| Bring | How | It becomes |
|---|---|---|
| **Functional specifications, business-rule documents** — Confluence or wiki pages, Word or PDF specs | export into `context/sources/` | rules in each area's `context/<area>.md`, citing document and section |
| **Existing test cases** — spreadsheets, test-tool exports, an older suite | export as CSV into `context/sources/` | an *Existing coverage* summary per area, which the planner builds on |
| **Known defects** — a bug list, problem areas | export into `context/sources/` | *Caveats* per area — where plans should push hardest |
| **Jira tickets** — the epics and stories of recent releases | **connected:** tell it which epics, releases or JQL to digest. **Not connected:** in Jira, run a filter or search for them, then *Export* → CSV with the description and acceptance-criteria columns, into `context/sources/` | rules per area, each citing its issue key; the digested scope listed in `context/BASELINE.md` |
| **User guides, release notes, a glossary** | export into `context/sources/` | the vocabulary in `context/BASELINE.md`, and behavior to confirm |
| **Application source, API docs, schema scripts** | give it the local path | validation rules, states, endpoints |

**Formats:** Markdown, text, CSV and PDF read best — save a Word document as PDF and a spreadsheet as CSV.
`context/sources/` is **committed** with the QA repo, so the whole team works from the same documents and every
rule can be re-checked against its source. Never put credentials, personal data or production extracts there;
a document too large or too confidential to commit can stay outside the repo — give the context-builder its
path instead.

**It distils, it does not copy.** No ticket text pasted, no whole documents — each rule it keeps cites where it
came from. Where a document and the running application disagree, it records the difference as a *known
unknown* for someone to settle, rather than picking one. It only ever reads Jira; it never edits a ticket.

### Existing test cases and test data — where they go, how they are used

| What you have | Where it goes | How it is used |
|---|---|---|
| Test-case sheets, test-tool exports | `context/sources/<name>.csv` | The context-builder summarizes them per area as *Existing coverage*; the planner builds each new plan on them |
| An older automated suite | stays where it is; export its list of cases into `context/sources/` | The same. Its code is not converted line by line — the generator writes fresh code by driving the app |
| QA test accounts | `.env`, one pair per role (2a) | The login files |
| Records tests rely on — IDs, names, codes | `data/testData.ts` keys | Each plan's *Data* field and the specs — never typed into a test (I3) |
| Seed and reset scripts | `data/sql_queries.ts` keys, called from `data/seed.ts` | Run before every run with `SEED_TEST_DATA=true` ([WORKFLOWS](WORKFLOWS.md) workflow 10) |
| How to put an area into a state | `context/<area>.md` → *Recipes* | The planner's *Given* steps; the seed |
| Personal data, production extracts | nowhere in the repo | — |

**Bringing old cases into the harness.** Point the planner at them — the file, the rows — with the story key.
Each becomes a candidate scenario: checked against the acceptance criteria, rewritten in the plan's format
with data keys instead of literal values, and given a **new TCID**. The plan's Scope Notes keep the mapping,
old ID → TCID, so the old copy can be retired. Manual cases stay manual; automated ones become code through the
generator. A feature older than anyone's Jira still needs a key: plan it under the story or epic that
introduced it, or a ticket the team raises for that regression area — one plan per area, starting with what
the next release touches.

---

## 4. Checklist before running `/playwright-context-builder`

**Must be done** — without these it cannot work:

- [ ] Harness copied in; `npm install` and `npx playwright install` run
- [ ] The QA environment opens in a browser from this machine — VPN on if needed — and is not mid-deploy
- [ ] `.env` has `APP_NAME`, `TRACKER_PROJECT_KEY` (your Jira project key, e.g. `ACME`) and `BASE_URL` (2a)
- [ ] Your QA test accounts to hand — one per kind of user, **dedicated QA accounts**, never a person's own
- [ ] Roles: either set up yourself (2b, 2c) — keys in `config/projectProfile.ts` and `PROJECT-PROFILE.md`
      section 2, one login file each, one credential pair each in `.env` — or left for the context-builder,
      which sets them up with you first and then tells you the `.env` names to fill
- [ ] `.mcp.json` created; Claude Code opened in the new repo; `/mcp` shows `playwright-test` connected (2e)
- [ ] `npm run check` passes

The login selectors (2d) can stay `CHANGE_ME` — the context-builder offers to fill them.

**Worth having** — each one widens what it can learn; none is required:

- [ ] Existing documents exported into `context/sources/` — specs, business rules, test cases, bug lists (3)
- [ ] Jira: connected and signed in, **one story key you know exists** to test it, and which epics or
      releases to digest — or, not connected, those issues exported as CSV into `context/sources/` (3)
- [ ] A read-only QA database account, in `.mcp.json`
- [ ] Local paths to the application source, OpenAPI/Swagger file, schema scripts, integration contracts
- [ ] Who to ask about which area

**Decided before starting:**

- [ ] Which environment — QA or staging, never production
- [ ] Areas it must stay out of — anything out of scope, or where even opening a screen has an effect
- [ ] The people testing in that environment know someone is exploring it
- [ ] Someone stays with it: it stops at every checkpoint and waits for an answer

You do **not** need to test the logins yourself first — its first step does that and tells you what to fix.
`npx playwright test tests/seeds/` runs the same check by hand.

---

## 5. What the context-builder does — and yes, it roams the application

Walking the application page by page is the **main part** of its job. In order:

| Step | What it does | You |
|---|---|---|
| **0. Preflight** | Shows the roles and asks if they are right; if not, sets them up with you — keys, login files — and tells you the `.env` names to fill (2b, 2c). Then runs every role's login file and reports per role: passed, or what to fix — a variable missing from `.env`, a selector still `CHANGE_ME`, an account rejected. If the selectors are the cause, it offers to fill them (2d). Says which Jira connection it found, and fetches your known story to prove it works. | name the roles; fill `.env`; agree to its edits |
| **1. Inventory** | Asks, by name, which sources exist and which it can reach — the app, database, source code, API docs, specs and business rules, existing test cases, bug history, Jira, user guides, people. Checks it can read each one. | answer; correct |
| **2. Roam** | **Signed out**, it looks at the login screen, password reset and any public pages. Then **as each role** — starting from that role's login file, so it begins already signed in — it clicks through the application page to page: the menus and top-level areas, each screen it can reach, what that role can do there, what is missing or disabled compared with the full-access role, and the click path to every area. It records the labels the UI uses. | confirm the module map and the role differences |
| **3. Read** | Reads what you brought (section 3): specs and business rules, existing test cases, bug history, the Jira epics you named, user guides, source code, API docs. | name what to digest |
| **4. Introspect** | If a database is connected: reads the schema for the areas it mapped, read-only, and confirms anything surprising against real rows. | — |
| **5. Write** | Drafts `context/BASELINE.md`, a `context/<area>.md` per area that needs one, `PROJECT-PROFILE.md` sections 2–4, one navigation plan per role, the cross-role permission matrix, and the module tag table — showing each before writing. | review the drafts |

**What it never does while roaming:**

- **Type a password.** The login file signs in inside the test runner; the agent is handed a signed-in page.
  It is also denied reading `.env`.
- **Change anything.** No form submitted, no record created or deleted, no setting changed — not even on the
  login screen. It is mapping an environment other people test in. If understanding an area needs an action,
  it stops and asks.
- **Guess.** What it could not reach or confirm goes into the baseline's *known unknowns*, which makes the
  other agents ask instead of assume.
- **Write tests.** That is the planner's and generator's job, per story, later.

It runs once at setup. Run it again only when the application changes — a new module or role, changed
navigation or permissions — and name the area to re-walk just that part.

---

## 6. Where everything is kept

Yes — tests are **written as code from the test cases**, and Playwright runs that code. Per story:

```
Jira story ──▶ planner ──▶ test cases (TCIDs) ──▶ generator ──▶ Playwright code ──▶ npm run regression / npx playwright test
               specs/<KEY>.plan.md                drives each case in the     tests/stories/<release>/<KEY>.spec.ts
                                                  real browser first
```

Only cases marked **Automated** in the plan become code; **Manual** cases are run by a person and their results
recorded. Everything is files in the new QA repo, reviewed and committed like any code.

| What | Produced by | Kept in | Committed? |
|---|---|---|---|
| What the harness knows about the app | context-builder | `context/BASELINE.md`, `context/<area>.md`, `PROJECT-PROFILE.md` §2–4, `specs/UserFlowsUserRolePermissions/`, `specs/RegressionTags/` | yes |
| The documents it read | you | `context/sources/` | yes |
| Test cases for a story — TCIDs, steps, expected results | planner | `specs/<STORY-KEY>.plan.md` and `.plan.csv` | yes |
| **Test code** — one test per automated test case | generator | `tests/stories/<release>/<STORY-KEY>.spec.ts` — see below for a story with no release yet | yes |
| Page objects — how tests talk to each screen | generator, or you | `pages/<Name>Page.ts` | yes |
| Fixtures — wiring page objects into tests | generator | `lib/BaseTest.ts` | yes |
| Test data and database queries | you, when an agent asks for them | `data/testData.ts`, `data/sql_queries.ts` | yes |
| Manual test results | you | `specs/execution/manual-results.csv` | yes |
| Automated results — each test case's latest, across runs | every run, automatically | `specs/execution/automated-results.csv` | yes |
| Run output and the HTML report | Playwright | `test-results/`, `playwright-report/` | no |
| Cycle reports after each run | written automatically | `reports/` | no |
| The cycle's final report | `npm run report:cycle -- --closure` | `specs/execution/closure/` | yes |
| Confirmed defects, before and after filing, and their screenshots | healer, defect-raiser | `specs/defects/defect-log.json`, `specs/defects/evidence/` | yes |
| Bugs to import, when Jira is not connected | defect-raiser | `specs/defects/defects.csv` | yes |

**Which folder the test code goes in.** The generator proposes the path and asks you to confirm it before
writing anything:

| The plan has | Folder |
|---|---|
| a release — the client release the story ships in, from Jira's fix version or asked by the planner | `tests/stories/2.26/ACME-1234.spec.ts` |
| no release yet, but an epic — it asks once whether a release is known | `tests/stories/ACME-100/ACME-1234.spec.ts` |
| neither | `tests/stories/ACME-1234.spec.ts` |

`npm run regression` asks which release to run before running anything; stories with no release yet are listed
as *no release* (`--release none`). When a story gets its release later, the plan gains a *Release* line and the
file moves to that release's folder.

---

## 7. Then

1. Review what it drafted: `PROJECT-PROFILE.md` sections 2–4 ([SETUP.md](../SETUP.md) step 4), the
   `context/<area>.md` documents, the navigation plans (step 7) and the module tags (step 8).
2. Finish the rest of [SETUP.md](../SETUP.md): page objects (5), test data (6), trimming what you do not use
   (9), and the final check (10).
3. Your first story: give `/playwright-test-planner` its Jira key — [WORKFLOWS.md](WORKFLOWS.md) workflow 1.

# {{PROJECT}} QA — setup checklist

Tick as you go. The file in brackets is where the answer is written down.

## A. Before setup day — gather

**Machine and access**
- [ ] Node 18 or later, and git, on the machine doing the setup
- [ ] Claude Code installed and signed in; the Atlassian plugin installed if Jira will be connected
- [ ] A local copy of the `ai-qa-harness` template repository, from whoever maintains it
- [ ] The machine can reach npm and download Playwright's browsers
- [ ] The {{PROJECT}} QA environment opens in a browser from this machine — VPN on if needed
- [ ] A time agreed when the QA environment is not being redeployed

**Accounts** (`accounts.md`) — dedicated QA accounts only, never a person's own, never production
- [ ] Every kind of user listed — one per set of permissions, not one per person
- [ ] One QA test account per kind of user, its password in the team's password manager
- [ ] Which one has full access — the baseline role
- [ ] Optional: a **read-only** QA database account for the agents
- [ ] Optional: a separate suite database account, if tests will seed or reset data

**Jira** (`jira.md`)
- [ ] The project key, and the issue key format
- [ ] One story key that exists, to test the connection
- [ ] Which epics, releases or JQL the context-builder should digest
- [ ] Connected, or exported as CSV into `context/sources/jira/`
- [ ] The bug issue type, its priority values, and whether it has a severity field

**Existing knowledge** (`context/sources/`, `paths.md`)
- [ ] Specs and business rules → `context/sources/specs/`
- [ ] Existing test cases, as CSV → `context/sources/test-cases/`
- [ ] Bug list and problem areas, as CSV → `context/sources/defects/`
- [ ] User guides, release notes, glossary → `context/sources/guides/`
- [ ] Optional: paths to source, API docs, schema scripts → `paths.md`
- [ ] Who to ask about what (`contacts.md`)

**Decisions** (`decisions.md`)
- [ ] The environment — QA or staging, never production
- [ ] Areas the agents must stay out of
- [ ] The people testing in that environment know someone will be exploring it
- [ ] Who sits with the context-builder — it stops at every checkpoint and waits

## B. Setup day — before `/playwright-context-builder`

- [ ] Harness exported into this folder (`START-HERE.md`, step 4); `git init`, `npm install`, `npx playwright install`
- [ ] `.env` made from `.env.example`: `APP_NAME`, `TRACKER_PROJECT_KEY`, `BASE_URL` (with `https://`, no trailing slash)
- [ ] Roles set up yourself — role keys, one login file each, one email/password pair each in `.env` — or left for the context-builder, which does it with you first
- [ ] Issue key format in `PROJECT-PROFILE.md` section 1; `storyKeyPattern` in `config/projectProfile.ts` tightened to it
- [ ] `.mcp.json` made from `.mcp.json.example`: `playwright-test` kept; `database` filled with the read-only account or deleted; `tracker` deleted if the Atlassian plugin is used
- [ ] Claude Code opened in this folder, the project's servers approved, `/mcp` shows `playwright-test` connected, signed in to Jira
- [ ] `npm run check` passes
- [ ] `git status` does not list `.env` or `.mcp.json`; first commit made

The login selectors can stay `CHANGE_ME` — the context-builder tries every login and offers to fill them.

## C. After the context-builder

- [ ] Its drafts reviewed and corrected: `PROJECT-PROFILE.md` sections 2–4, `context/<area>.md`, the navigation plans, the module tags
- [ ] Section 7 — the severity rubric and its mapping to Jira's fields (`decisions.md`, `jira.md`)
- [ ] Section 10 — test types in scope, entry and exit criteria; `exitCriteria` in `config/projectProfile.ts` matches
- [ ] Section 5 — database checks in scope or not (`DB_VALIDATION_ENABLED`); if in scope, the suite's `DB_*` settings
- [ ] Section 6 — API tests in scope or not
- [ ] Release naming agreed; `BUILD_UNDER_TEST` set for the deployed build
- [ ] Test data: known records as keys in `data/testData.ts`; reset and seed in `data/seed.ts`
- [ ] What is not used trimmed — `SETUP.md` step 9 (API client, database layer, browsers in `playwright.config.ts`)
- [ ] Final check: `npm run check`, `npx playwright test tests/seeds/`, `npx playwright test tests/example.spec.ts --grep "@Priority1"`
- [ ] Owners agreed: who runs `/playwright-harness-improver` and keeps `HARNESS-CHANGES.md`, who records manual results, branch and commit conventions

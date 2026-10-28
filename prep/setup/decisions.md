# {{PROJECT}} — decisions before setup

Answer what you can now; the rest is decided after the context-builder. On setup day these move into
`PROJECT-PROFILE.md`, which is then the source of truth — keep this file only as the record of why.

## The environment — before setup day

| Question | Answer |
|---|---|
| Environment the harness runs against — QA or staging, **never production** | |
| Its address (`BASE_URL`) — with `https://`, no trailing slash | |
| Areas the agents must stay out of — out of scope, or where even opening a screen has an effect | |
| Who has been told someone will be exploring the environment | |
| Who sits with the context-builder — it stops at every checkpoint and waits | |
| When the environment is not being redeployed | |

## Scope — `PROJECT-PROFILE.md` sections 5, 6, 10

| Question | Answer |
|---|---|
| Check results in the database as well as on screen? (section 5, `DB_VALIDATION_ENABLED`) | yes / no |
| Database engine, if yes — SQL Server or PostgreSQL (`DB_ENGINE`) | |
| API tests in scope? (section 6) | yes / no |
| Accessibility checks in scope? | yes / no |
| Manual test cases recorded in the harness? | yes / no |
| Browsers to run — the config runs Chromium and Edge | |

## Defect severity — `PROJECT-PROFILE.md` section 7

What each severity means for {{PROJECT}}, with one real example each, and the Jira values it maps to
(`jira.md`).

| Severity | Means | Example from {{PROJECT}} | Jira priority | Jira severity |
|---|---|---|---|---|
| P1 Critical | | | Highest | |
| P2 Major | | | High | |
| P3 Minor | | | Medium | |
| P4 Low | | | Low | |

## Releases — `PROJECT-PROFILE.md` section 8

| Question | Answer |
|---|---|
| How client releases are named — the same as Jira's fix versions | e.g. `2.26` |
| How a deployed build is named (`BUILD_UNDER_TEST`) | e.g. `2.26.0-rc3` |

## Exit criteria — `PROJECT-PROFILE.md` section 10

When may a test cycle close? Defaults shown — change any. They go into `exitCriteria` in
`config/projectProfile.ts` too.

| Criterion | Default | {{PROJECT}} |
|---|---|---|
| Priority 1 test cases passing | 100% | |
| Priority 2 test cases passing | 95% | |
| Acceptance criteria covered by a passing test case | 100% | |
| Open P1 defects | 0 | |
| Open P2 defects | 0 | |
| Test cases not executed | 0 | |

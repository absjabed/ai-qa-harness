# Knowledge baseline

> `<Application>` · QA context · baseline · `<YYYY-MM-DD>`

What the harness knows about this application, where each piece came from, and — just as importantly —
what it does not know yet.

The `playwright-context-builder` agent drafts this. Correct it: it only knows what it was given access to,
and it will say so rather than fill gaps.

---

## 1. Sources available

What exists, and whether the harness can actually reach it. "Reachable" means an agent can read it during a
run — not that it exists somewhere in the organization.

| Source | Exists | Reachable | Where / how |
|---|---|---|---|
| Running application (QA) | `<yes>` | `<yes — BASE_URL>` | `<env name>` |
| Database | `<yes>` | `<yes — read-only MCP / no>` | `<server + database name, never credentials>` |
| Application source | `<yes>` | `<yes — local path / no>` | `<repo or path>` |
| API documentation | `<yes — OpenAPI / Swagger / none>` | `<yes / no>` | `<url or path>` |
| API contracts / integration specs | `<...>` | `<...>` | `<...>` |
| Design mockups | `<...>` | `<pasted per story>` | `<tool>` |
| Functional specs / business-rule docs | `<yes — Confluence / Word / PDF>` | `<yes — in context/sources/ / no>` | `<which documents, which version>` |
| Existing test cases | `<yes — spreadsheet / test tool / old suite>` | `<yes — CSV in context/sources/ / no>` | `<where, how many>` |
| Known defects / bug history | `<...>` | `<...>` | `<where>` |
| Jira tickets (digest) | `<yes>` | `<yes — tracker connected / no>` | `<which epics, releases or JQL were digested>` |
| User guides / release notes / glossary | `<...>` | `<...>` | `<where>` |
| Requirement docs / wiki | `<...>` | `<no — summarized here by hand>` | `<where>` |
| Subject-matter contacts | n/a | n/a | `<who to ask about what>` |

## 2. Modules

The application's feature areas, as reachable by a user. This is the source for PROJECT-PROFILE.md section
4 and the tag registry in `specs/RegressionTags/`.

| Module | What it does | Roles that reach it | Entry point |
|---|---|---|---|
| `<Module>` | `<one line>` | `<roles>` | `<how a user gets there>` |

## 3. Roles and what they can do

Feeds PROJECT-PROFILE.md section 2 and the per-role navigation plans. Detail belongs in those plans; this
is the summary.

| Role | Scope of authority | Notable restrictions |
|---|---|---|
| `<role>` | `<what it can act on>` | `<what it cannot do>` |

## 4. Domain vocabulary

What the business calls things, what the UI calls them, and what the database calls them. Divergence
between the three is normal and worth recording — it is where misunderstandings start.

| Business term | UI label | Data field | Meaning |
|---|---|---|---|
| `<term>` | `<label>` | `<table.column>` | `<one line>` |

## 5. APIs

| Endpoint | Method | Purpose | Auth | Used by tests? |
|---|---|---|---|---|
| `<path>` | `<verb>` | `<one line>` | `<scheme>` | `<yes / not yet>` |

## 6. Data layer

| Question | Answer |
|---|---|
| Engine and version | `<...>` |
| Schema owner / prefix | `<...>` |
| Reachable from test machines? | `<yes / firewalled — see below>` |
| Is QA data reseeded? | `<how often, by whom — this decides whether tests can rely on fixed values>` |
| Tables tests touch | `<list, or "see context/<area>.md">` |

## 7. Context documents written so far

| Document | Area | Provenance | Last verified |
|---|---|---|---|
| `<file.md>` | `<area>` | `<source>` | `<date>` |

## 8. Known unknowns

The most useful section here. An agent that knows the boundary of its knowledge asks instead of guessing —
so keep this current rather than tidy.

- `<What has not been explored, and what would be needed to close it.>`
- `<Any rule believed true but never confirmed at source.>`
- `<Any area where the running app and the documentation disagree.>`

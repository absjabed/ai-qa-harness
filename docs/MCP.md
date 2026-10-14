# MCP servers — how agents reach the browser, the database and the tracker

Three of the five agents cannot work without a browser, and several work considerably better with read
access to the database and the issue tracker. All three arrive through MCP servers configured in
`.mcp.json`.

Copy `.mcp.json.example` to `.mcp.json` and fill it in. `.mcp.json` is gitignored, because a database entry
carries a password — and `.claude/settings.json` denies agents reading it.

That file is Claude Code's format. MCP is an open protocol, so the same servers work in any MCP-capable
tool — only the config file's location and shape differ. [`agents/README.md`](../agents/README.md) lists
where each tool looks.

---

## `playwright-test` — required

| | |
|---|---|
| Needed by | `playwright-context-builder`, `playwright-test-generator`, `playwright-test-healer` |
| Without it | The context-builder cannot walk the application. The generator cannot drive the browser, so it will not write a test. The healer cannot inspect a failing page. |

It ships with `@playwright/test`, so there is nothing extra to install:

```json
{ "command": "npx", "args": ["playwright", "run-test-mcp-server"] }
```

That entry is verified — it is what `npx playwright init-agents` generates for itself.

This is not a soft dependency. The generator's whole method is to perform each step against the real
application and then write up what actually happened — take the browser away and there is nothing left but
guessing from plan text, which it refuses to do.

## `database` — optional, high value

| | |
|---|---|
| Used by | `playwright-context-builder` to introspect the schema · `playwright-test-healer` to adjudicate a failing DB-backed assertion instead of handing it back to you |
| Without it | Agents cannot see your schema, so they will not write SQL — every database assertion needs you to hand over the query text. And the healer cannot tell a timing problem from a real defect when a DB-backed assertion fails; it stops and asks you instead. |

This is the single biggest reduction in setup friction available. The agents' refusal to invent SQL is
correct — a query written without schema visibility is plausible and wrong — but it is a refusal born of
blindness, and this removes the blindness.

### The example server

`.mcp.json.example` uses `@executeautomation/database-server`, which speaks both engines the harness
supports — PostgreSQL (`--postgresql --host … --database …`) and SQL Server (`--sqlserver --server …
--database …`). The version is pinned, because `npx -y` would otherwise fetch whatever was published most
recently every time the server starts.

| Tool | Writes? | In `.claude/settings.json` |
|---|---|---|
| `read_query`, `list_tables`, `describe_table` | No | allowed |
| `write_query`, `create_table`, `alter_table`, `drop_table` | Yes | **denied** |
| `append_insight` | Yes, to its own memo | **denied** |
| `export_query`, `list_insights` | No | neither — prompts if used |

It has **no read-only mode**. The deny rules stop an agent calling its write tools, but the account is what
makes read-only true: a `read_query` carrying an `UPDATE` would otherwise be up to the server to refuse.

Any other MCP server for your engine works too. Rename its tools in the `.claude/settings.json` rules — the
rules are only as good as the names in them.

### Use a read-only account

Give the MCP server credentials that can `SELECT` and nothing else, against a QA database.

An agent with write access to a database is one confused instruction away from modifying data that other
people's tests depend on, and there is no undo. Read-only removes that possibility entirely rather than
relying on the agent's judgment.

Never point it at production. Nothing in QA justifies it, and the context documents these agents write are
committed to a repository.

### Introspection can be wrong

Schema introspection reports structure, not intent, and it is not always right about structure either — a
column that is genuinely nullable can be reported as `NOT NULL` depending on how the tool reads metadata.

So: confirm anything surprising with a direct query against real rows before writing it into a context
document. A context document repeating an introspection artifact as fact is worse than no document, because
an agent will act on it confidently.

### Prefer distilling to querying repeatedly

The point of database access is not that agents query the schema on every run. It is that someone — a
person, or `playwright-context-builder` — explores it once and writes down the ten facts that matter in
`context/`. That document is then the durable knowledge; the MCP server is how it got written.

## `tracker` — optional

| | |
|---|---|
| Used by | `playwright-test-planner` to fetch a story by its key · `playwright-defect-raiser` to create bugs · `playwright-test-healer` to see which bugs are fixed, and to comment the retest result |
| Without it | Stories are pasted into the conversation, defects become `specs/defects.csv` for someone to import, and the retest needs telling which bugs were fixed. Everything still works; there is just more copying by hand. |

The example is Jira, through Atlassian's remote MCP server:

```json
"tracker": { "type": "http", "url": "https://mcp.atlassian.com/v2/mcp?tools=all" }
```

Sign in by running `/mcp` in Claude Code — it is OAuth, so no token goes in the file. Two details matter:

- **Keep `?tools=all`.** Without it the server exposes two generic tools, `discovery` and `execute`, and
  every Jira operation goes through `execute` — which would slip past the per-tool rules below. That is why
  `execute` is denied.
- **Keep the key `tracker`.** The rules name tools as `mcp__tracker__<tool>`.

### What agents may do in the tracker

| | Tools | Why |
|---|---|---|
| **Allowed** | read an issue, search by JQL, read issue-type and link-type metadata, read comments | Fetching stories and checking bug status |
| **Ask every time** | create an issue, link issues, comment, attach a file | A person approves every write to a system other people work from |
| **Denied** | edit or move an issue, delete anything, worklogs, sprints, boards, versions, project admin | Nothing in the harness needs them; changing a bug's status is a person's decision |

The agents' instructions say the same — the defect-raiser asks before creating a batch, the healer before
commenting, and the planner only reads. The rules make it hold when an instruction is missed.

Another tracker works the same way if it has an MCP server: wire it under the key `tracker` and replace the
tool names in `.claude/settings.json`. The agents describe what they need — fetch an issue, search, create a
bug, comment — rather than naming Jira's tools.

---

## Guard rails — `.claude/settings.json`

Shipped with the harness and committed, so they apply to everyone who runs it in Claude Code. Besides the
database and tracker rules above, it denies agents reading `.env` and `.mcp.json`: no agent needs a
password, because each role's seed in `tests/seeds/` logs in inside the test runner.

These are a second line behind the agents' own instructions, not a sandbox — a shell command can still read
a file the `Read` rule denies. Personal overrides belong in `.claude/settings.local.json`, which is
gitignored.

Other tools have their own permission systems; [`agents/README.md`](../agents/README.md) covers porting.

---

## Verifying

After configuring, confirm each server is connected before running an agent that needs it — `/mcp` in
Claude Code lists them, and signs you in to the tracker. If the generator reports that
`generator_setup_page` is unavailable, the Playwright MCP server is not connected — fix that rather than
letting it proceed, because an agent that cannot drive the browser produces nothing usable.

## What does not belong in `.mcp.json`

The harness's own database connection, used by tests at runtime, comes from `.env` via
`config/testConfig.ts`. It is separate on purpose: `.env` is the credential the *suite* runs with,
`.mcp.json` is the credential an *agent* reads with, and the second should be strictly weaker than the
first.

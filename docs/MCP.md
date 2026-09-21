# MCP servers — how agents reach the browser and the database

Three of the five agents cannot work without a browser, and all of them work considerably better with read
access to the database. Both arrive through MCP servers configured in `.mcp.json`.

Copy `.mcp.json.example` to `.mcp.json` and fill it in. `.mcp.json` is gitignored, because a database entry
usually carries a connection string.

That file is Claude Code's format. MCP is an open protocol, so the same servers work in any MCP-capable
tool — only the config file's location and shape differ. [`agents/README.md`](../agents/README.md) lists
where each tool looks.

---

## `playwright-test` — required

| | |
|---|---|
| Needed by | `playwright-test-generator`, `playwright-test-healer` |
| Without it | The generator cannot drive the browser, so it will not write a test. The healer cannot inspect a failing page. |

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
| Used by | `playwright-context-builder` mainly; the others benefit indirectly |
| Without it | Agents cannot see your schema, so they will not write SQL. Every database assertion needs you to hand over the query text. |

This is the single biggest reduction in setup friction available. The agents' refusal to invent SQL is
correct — a query written without schema visibility is plausible and wrong — but it is a refusal born of
blindness, and this removes the blindness.

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

---

## Verifying

After configuring, confirm each server is connected before running an agent that needs it. If the generator
reports that `generator_setup_page` is unavailable, the Playwright MCP server is not connected — fix that
rather than letting it proceed, because an agent that cannot drive the browser produces nothing usable.

## What does not belong in `.mcp.json`

The harness's own database connection, used by tests at runtime, comes from `.env` via
`config/testConfig.ts`. It is separate on purpose: `.env` is the credential the *suite* runs with,
`.mcp.json` is the credential an *agent* reads with, and the second should be strictly weaker than the
first.

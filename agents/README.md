# `agents/` — the canonical agent definitions

The five agents live here as plain markdown, with no vendor's frontmatter and no vendor's tool names.
Everything under `.claude/` is a thin wrapper that points at these files.

**Edit these. Never edit a wrapper's prose** — a wrapper that carries instructions of its own is a second
copy waiting to drift.

| Agent | Role | Needs a browser? | Interactive? |
|---|---|---|---|
| [`playwright-context-builder`](playwright-context-builder.md) | Learns the application | Yes | Yes |
| [`playwright-test-planner`](playwright-test-planner.md) | Story → reviewed test plan | No | Yes |
| [`playwright-test-generator`](playwright-test-generator.md) | Plan → spec, driven live | Yes | Yes |
| [`playwright-test-healer`](playwright-test-healer.md) | Triages failures | Yes | Asks once |
| [`playwright-defect-raiser`](playwright-defect-raiser.md) | Files confirmed defects | No | No |

---

## What is actually vendor-specific

Very little. Of the whole harness:

- **The test suite** — `playwright.config.ts`, `config/`, `data/`, `lib/`, `pages/`, `tests/` — involves no
  AI at all. `npm test` runs it.
- **The knowledge layer** — `PROJECT-PROFILE.md`, `context/`, `specs/`,
  `TEST-AUTHORING-INVARIANTS.md` — is plain markdown any tool can read.
- **These agent definitions** are plain prose.

What binds to a tool is only: where the wrapper file lives, what its frontmatter looks like, and what the
file-access tools are called.

## Adding support for another tool

Three steps.

### 1. Put a wrapper where that tool looks for agent definitions

| Tool | Location |
|---|---|
| Claude Code | `.claude/commands/` (shipped) or `.claude/agents/` |
| GitHub Copilot | `.github/prompts/` |
| Cursor | `.cursor/rules/` |
| OpenCode | `.opencode/agent/` |
| VS Code | `.github/chatmodes/` |

The body of every wrapper is the same one line: read `agents/<name>.md` and follow it exactly.

### 2. Translate the frontmatter

Only three things matter, and two are optional:

- **The tool allow-list.** Translate the names — the table below. If the tool has no way to restrict
  tools, drop the field; the agents' own instructions still constrain what they do.
- **Model selection**, if the tool supports pinning one. See *Model choice* below — this matters more than
  the syntax.
- **A description**, for tools that show one.

Everything else in Claude's frontmatter (`color`, `effort`) is cosmetic or Claude-only.

### 3. Point it at the MCP servers

MCP is an open protocol. The servers are the same; only the config file differs — `.mcp.json` for Claude
Code, `.vscode/mcp.json` for VS Code, `mcp.json` for Cursor, and so on. Copy the server entries from
`.mcp.json.example` into whatever shape your tool expects.

If your tool restricts agents to an allow-list, a database server's tools have to be on the list for
`playwright-context-builder` and `playwright-test-healer` — the only two that use it. The canonical
definitions cannot name those tools, because the server is project-chosen. List only its read-only tools.
The Claude wrappers for both agents carry a note saying so.

## Tool-name translation

The canonical definitions never name a file tool, so this only affects wrapper frontmatter.

| Capability | Claude Code | Common alternatives |
|---|---|---|
| Read a file | `Read` | `read_file`, `view`, `str_replace_editor` |
| Write a file | `Write` | `create_file`, `write_file` |
| Edit a file | `Edit`, `MultiEdit` | `edit_file`, `str_replace`, `apply_patch` |
| Find files | `Glob` | `file_search`, `find` |
| Search contents | `Grep` | `grep_search`, `search`, `ripgrep` |
| List a directory | `LS` | `list_dir` |
| Ask the user | `AskUserQuestion` | Often implicit — the agent simply asks in chat |

MCP tool names differ by client convention too: Claude Code writes
`mcp__playwright-test__browser_click`, while Playwright's own definitions write
`playwright-test/browser_click`. Same tool, same server.

## Model choice matters more than syntax

Porting is a twenty-minute job. Choosing the model is the decision that determines whether the ported
agents are worth running.

These definitions lean on behaviors that weaker models drop first:

- The planner's **seven blocking checkpoints**. A model that does not reliably stop produces a plan nobody
  approved.
- The generator's **refusal to write a test for a step it never drove**. This is the single most valuable
  behavior in the harness, and the easiest to lose.
- The **self-audits** before saving, which are the quality floor.
- Every agent's willingness to **say it does not know** rather than fill a gap plausibly.

The Claude wrappers pin the strongest model, and set high reasoning effort on the planner and the
context-builder because both do long multi-step work. Match that intent on whatever you port to. If the
ported agents start producing output that looks right but skipped the checkpoints, the model is the first
thing to suspect — not the prompt.

## Interaction model

Four of the five need to ask a question and wait for an answer. A tool running headless in CI cannot do
that, so those four are not CI-shaped on any vendor. `playwright-defect-raiser` is the exception: it makes
no judgments and runs unattended by design.

## Relationship to `npx playwright init-agents`

Playwright ships its own planner, generator and healer, and can generate wrappers for six tools:

```bash
npx playwright init-agents --loop claude     # or codex, copilot, opencode, vscode, vscode-legacy
```

The agents here started from those and diverged substantially — they add the invariants, the checkpoints,
the tagging conventions, the context layer, and two agents upstream does not have. So:

- **Do not run `init-agents` in a configured harness.** It writes its own definitions into
  `.claude/agents/` and its own `.mcp.json`, which will sit alongside ours confusingly.
- **Do use it as a reference** for what a wrapper looks like on a tool you are adding support for. Run it
  in a scratch directory and read what it produces.
- It is also the authority on the MCP server invocation, which is how `.mcp.json.example` was verified.

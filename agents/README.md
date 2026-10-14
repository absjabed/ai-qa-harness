# `agents/` — the canonical agent definitions

The six agents live here as plain markdown, with no vendor's frontmatter and no vendor's tool names.
Everything under `.claude/` is a thin wrapper that points at these files.

**Edit these. Never edit a wrapper's prose** — a wrapper that carries instructions of its own is a second
copy waiting to drift.

| Agent | Role | Needs a browser? | Interactive? |
|---|---|---|---|
| [`playwright-context-builder`](playwright-context-builder.md) | Learns the application | Yes | Yes |
| [`playwright-test-planner`](playwright-test-planner.md) | Story → reviewed test plan | No | Yes |
| [`playwright-test-generator`](playwright-test-generator.md) | Plan → spec, driven live | Yes | Yes |
| [`playwright-test-reviewer`](playwright-test-reviewer.md) | Independent check: plan against ticket, test against plan | No | No — returns findings |
| [`playwright-test-healer`](playwright-test-healer.md) | Triages failures | Yes | At decisions |
| [`playwright-defect-raiser`](playwright-defect-raiser.md) | Files confirmed defects | No | Asks once |

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

- **The tool list.** The Claude wrappers carry `allowed-tools`, which in a Claude Code command
  *pre-approves* those tools for the turn so they run without a prompt — it does not restrict anything; the
  restrictions live in `.claude/settings.json` (step 4). Other tools may treat their list as an allow-list:
  translate the names (the table below), and if the tool has no such field, drop it.
- **Model selection**, if the tool supports pinning one. See *Model choice* below — this matters more than
  the syntax.
- **A description**, for tools that show one.

Everything else in Claude's frontmatter (`effort`) is Claude-only.

### 3. Point it at the MCP servers

MCP is an open protocol. The servers are the same; only the config file differs — `.mcp.json` for Claude
Code, `.vscode/mcp.json` for VS Code, `mcp.json` for Cursor, and so on. Copy the server entries from
`.mcp.json.example` into whatever shape your tool expects.

If your tool restricts agents to an allow-list, the database and tracker servers' tools have to be on it
for the agents that use them — the context-builder and healer for the database; the planner, healer and
defect-raiser for the tracker. List only read-only tools, plus the tracker's create, link and comment tools
for the defect-raiser and healer.

### 4. Carry over the guard rails

`.claude/settings.json` holds the harness's permission rules for Claude Code: agents may not read `.env` or
`.mcp.json`, may not call the database server's write tools, and must ask before any write to the tracker.
Recreate the equivalent in your tool's own permission system. The agents' instructions say the same things,
so the rules are a second line — but it is the line that holds when an instruction is missed.

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

Five of the six need to ask a question and wait for an answer, so none of those is CI-shaped on any vendor.
`playwright-defect-raiser` asks the least of them: it makes no judgments, and asks once — which pending
defects to file — before filing anything.

`playwright-test-reviewer` asks nothing. Other agents start it — the generator after every spec it writes,
the planner when the user agrees — and it must start **in a fresh context**, seeing only the files it is
named, never the author's conversation: that independence is its whole value. In Claude Code it is a
sub-agent, `.claude/agents/playwright-test-reviewer.md`, as well as a command a person can run. In another
tool, wire it as whatever starts a separate session or sub-agent; if the tool has neither, run it yourself
in a new session and paste its findings back.

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

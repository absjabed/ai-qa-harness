# {{PROJECT}} — Jira

| Question | Answer | Goes to |
|---|---|---|
| Jira project key — the letters before the dash in every ticket ID (`ABC-1234` → `ABC`) | | `.env` `TRACKER_PROJECT_KEY`; `PROJECT-PROFILE.md` section 1 |
| Issue key format | e.g. `ABC-1234` | `PROJECT-PROFILE.md` section 1; `storyKeyPattern` in `config/projectProfile.ts` — `/^ABC-\d+$/` |
| One story key that certainly exists | | The context-builder fetches it to prove the connection works |
| Connection | Atlassian plugin in Claude Code · MCP server · not connected | `.mcp.json`, Claude Code `/mcp` |
| What to digest — epics, releases or a JQL query | | The context-builder's Jira question |
| How releases are named (Jira fix versions) | e.g. `2.26` | Test folders `tests/stories/<release>/`; `npm run regression` |
| Bug issue type name | e.g. `Bug` | Confirms what the defect-raiser asks when it files a bug — it reads the issue types from Jira itself |
| Priority values on a bug | e.g. Highest, High, Medium, Low | `PROJECT-PROFILE.md` section 7 — mapped from P1–P4 |
| Is there a Severity field on bugs? Its values? | | `PROJECT-PROFILE.md` section 7 |

**Not connecting Jira?** Run a Jira filter or search for the epics and stories to digest, then *Export* → CSV
with the description and acceptance-criteria columns, into `context/sources/jira/`. Bugs are then written to
a CSV for you to import, instead of being created in Jira.

**Bug statuses** are your team's own Jira workflow. Nothing to write down here: when a fixed bug is retested,
the harness lists the transitions that bug offers and asks which to apply.

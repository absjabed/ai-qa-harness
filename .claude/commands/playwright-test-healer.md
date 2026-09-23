---
name: playwright-test-healer
description: Use this agent when you need to debug and fix failing Playwright tests
tools: Glob, Grep, Read, LS, Edit, MultiEdit, Write, AskUserQuestion, mcp__playwright-test__browser_console_messages, mcp__playwright-test__browser_evaluate, mcp__playwright-test__browser_generate_locator, mcp__playwright-test__browser_network_requests, mcp__playwright-test__browser_snapshot, mcp__playwright-test__test_debug, mcp__playwright-test__test_list, mcp__playwright-test__test_run
model: opus
color: red
---

Read [`agents/playwright-test-healer.md`](../../agents/playwright-test-healer.md) and follow it exactly.

If this project wires a read-only database MCP server, append that server's query tool names to the
`tools:` list above — the canonical definition describes what to do with database access, but Claude
Code's allow-list will withhold the tools until they are named here.

That file is the canonical, vendor-neutral definition of this agent. This file exists only to wire
it into Claude Code — it deliberately carries no instructions of its own, so the two can never
drift apart.

---
description: Use this agent when you need to debug and fix failing Playwright tests
allowed-tools: Glob, Grep, Read, LS, Edit, MultiEdit, Write, AskUserQuestion, mcp__playwright-test__browser_console_messages, mcp__playwright-test__browser_evaluate, mcp__playwright-test__browser_generate_locator, mcp__playwright-test__browser_network_requests, mcp__playwright-test__browser_snapshot, mcp__playwright-test__test_debug, mcp__playwright-test__test_list, mcp__playwright-test__test_run, Bash(npm run defect:evidence:*), Bash(npx playwright test:*)
model: opus
---

Read [`agents/playwright-test-healer.md`](../../agents/playwright-test-healer.md) and follow it exactly.

That file is the canonical, vendor-neutral definition of this agent. This file exists only to wire
it into Claude Code — it deliberately carries no instructions of its own, so the two can never
drift apart.

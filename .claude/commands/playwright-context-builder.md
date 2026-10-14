---
description: Use this agent at setup, or whenever the application has changed enough that the harness's knowledge of it is stale. It inventories what can be learned about the application, explores it, and writes the baseline the other agents read.
allowed-tools: Glob, Grep, Read, LS, Write, Edit, AskUserQuestion, mcp__playwright-test__browser_click, mcp__playwright-test__browser_evaluate, mcp__playwright-test__browser_hover, mcp__playwright-test__browser_navigate, mcp__playwright-test__browser_press_key, mcp__playwright-test__browser_select_option, mcp__playwright-test__browser_snapshot, mcp__playwright-test__browser_type, mcp__playwright-test__browser_wait_for, mcp__playwright-test__generator_setup_page, mcp__playwright-test__test_list, mcp__playwright-test__test_run
model: opus
effort: xhigh
---

Read [`agents/playwright-context-builder.md`](../../agents/playwright-context-builder.md) and follow it exactly.

That file is the canonical, vendor-neutral definition of this agent. This file exists only to wire
it into Claude Code — it deliberately carries no instructions of its own, so the two can never
drift apart.

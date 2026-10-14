---
description: Use this agent when the harness does not behave as the team needs — an agent did the wrong thing, or the harness does not fit how the team works. It finds the cause, proposes the smallest change in the right file, applies it on agreement and records it in HARNESS-CHANGES.md.
allowed-tools: Glob, Grep, Read, LS, Edit, MultiEdit, Write, AskUserQuestion, Bash(npm run check:*), Bash(npm run check)
model: opus
---

Read [`agents/playwright-harness-improver.md`](../../agents/playwright-harness-improver.md) and follow it exactly.

That file is the canonical, vendor-neutral definition of this agent. This file exists only to wire
it into Claude Code — it deliberately carries no instructions of its own, so the two can never
drift apart.

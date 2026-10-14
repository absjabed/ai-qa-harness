---
name: playwright-test-reviewer
description: Independent, read-only review of a test plan against its ticket (plan review) or of a generated spec against its plan (test review). Started by the planner and the generator with a fresh context; returns findings, edits nothing.
tools: Glob, Grep, Read
model: opus
---

Read `agents/playwright-test-reviewer.md` and follow it exactly. The task you were given names the mode
and the files.

That file is the canonical, vendor-neutral definition of this agent. This file exists only to make it a
Claude Code sub-agent — one the planner and the generator can start in a fresh context — and carries no
instructions of its own.

---
description: Use this agent to run the tests — one story's, or a release's regression — and see the run through: failures to the healer, confirmed defects to the defect-raiser, manual results recorded, the report written.
allowed-tools: Glob, Grep, Read, LS, Edit, AskUserQuestion, Bash(npm run regression:*), Bash(npm run results:last:*), Bash(npm run report:cycle:*)
model: opus
---

Read [`agents/playwright-test-executor.md`](../../agents/playwright-test-executor.md) and follow it exactly.

That file is the canonical, vendor-neutral definition of this agent. This file exists only to wire
it into Claude Code — it deliberately carries no instructions of its own, so the two can never
drift apart.

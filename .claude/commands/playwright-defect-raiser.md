---
name: playwright-defect-raiser
description: Use this agent to formally raise defects that the playwright-test-healer agent has already confirmed with the user and recorded in specs/temp-defects/defect-log.json.
tools: Glob, Grep, Read, Edit, MultiEdit, Write
model: opus
color: orange
---

Read [`agents/playwright-defect-raiser.md`](../../agents/playwright-defect-raiser.md) and follow it exactly.

That file is the canonical, vendor-neutral definition of this agent. This file exists only to wire
it into Claude Code — it deliberately carries no instructions of its own, so the two can never
drift apart.

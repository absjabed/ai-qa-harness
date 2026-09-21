# `<Area>` — context for QA

> `<Application>` · QA context · `<area-slug>` · `<YYYY-MM-DD>`

`<One paragraph: what this area of the application does, and why a test author needs to understand it.
Written for someone who knows testing but not this codebase.>`

**Provenance:** `<Where this knowledge came from — application source (name the classes or modules),
database introspection, observed in the running app, or supplied by a team member. Be specific enough
that someone can re-verify it.>`

**Scope:** `<QA and development environments only / applies to every environment / etc. If any recipe below
writes to the database, say plainly that it must never be run against production.>`

---

## Quick reference

`<The tables, endpoints or screens involved. One line each — what it holds, and the columns or fields that
matter. Leave out everything a test author will never touch.>`

| Table / endpoint | Purpose | Key fields |
|---|---|---|
| `<name>` | `<what it holds>` | `<the two or three that matter>` |

## Invariants

`<Rules the application enforces. Phrase them as rules about the domain rather than descriptions of code,
so they stay true through a refactor. Say what happens when one is violated — usually the answer is
"behavior is undefined", and that is worth writing down.>`

1. `<Rule.>` `<Why it matters, or what breaks without it.>`
2. `<Rule.>`

## States and transitions

`<If the entity has a lifecycle, name the states and which transitions are legal. This is what the planner
reads to design state-transition scenarios, and what tells the healer whether a blocked action is a
defect or the rule working.>`

| From | To | Trigger | Allowed for |
|---|---|---|---|
| `<state>` | `<state>` | `<action>` | `<role>` |

## Recipes

`<How to put the system into a given state for a test. Each recipe: what it produces, the steps or SQL,
and anything to clean up afterwards.>`

### 1. `<Scenario name>`

`<What this produces and when you would want it.>`

```sql
-- <the statements, with real column names>
```

`<Cleanup, if the recipe writes anything.>`

## Verification

`<How to confirm a state afterwards. These become named keys in data/sql_queries.ts — write them here
first, in a form that can be lifted directly.>`

```sql
-- <query>
```

## Caveats

`<Where this document is thin, uncertain, or likely to drift. An agent that knows the boundary of its
knowledge asks instead of guessing, so this section earns its place.>`

- `<Known gap.>`
- `<Anything observed rather than confirmed at source.>`

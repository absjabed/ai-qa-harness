# `context/` — what the agents know about your application

The harness is a separate repository from the application it tests. It cannot read your source, your
schema, or your API contracts unless you put that knowledge here.

This folder is where it goes — **distilled**, not dumped.

---

## Why distilled

A schema dump is not context. A real one runs to tens of thousands of lines, and handing that to an agent
buries the four facts that actually matter about a table in ten thousand that don't.

What works instead is a short document that answers, for one area of the application: which tables or
endpoints matter, what rules the application enforces on them, how to set up a given state, and how to
verify it afterwards. That is the difference between an agent that can write a correct database assertion
and one that has to ask you for every query.

## What belongs here

| Put here | Don't put here |
|---|---|
| Distilled notes on one subsystem — its tables, its invariants, its states | Raw schema dumps or full DDL |
| Business rules the application enforces, and where they come from | Source files copied verbatim |
| API contracts, endpoint lists, auth schemes, payload shapes | Anything with real credentials, tokens or connection strings |
| The module map — what the application's feature areas are and how to reach them | Personal data, or a production data extract |
| Terminology: what the business calls things, and what the UI calls them | Meeting notes, raw ticket text, or anything not durable |
| Business rules distilled from specs and Jira tickets, each citing its source | Whole documents, or copied ticket descriptions |
| What existing test cases already cover, per area | The existing test cases themselves |
| `BASELINE.md` — the inventory of what is known and what isn't | Screenshots (paste those into the conversation instead) |

## The shape of a context document

Copy `_TEMPLATE.md`. The sections exist because each answers a question an agent otherwise has to ask you:

1. **Scope and provenance** — what area this covers, and where the knowledge came from. A reader needs to
   know whether a rule was read out of the source, observed in the UI, or assumed.
2. **Quick reference** — the tables or endpoints involved, one line each.
3. **Invariants** — rules the application enforces. State them as rules, not as descriptions of code, so
   they survive a refactor.
4. **Recipes** — how to put the system into a given state, including the SQL or API calls to do it.
5. **Verification** — how to confirm a state afterwards. These become `data/sql_queries.ts` keys.
6. **Caveats** — where the documentation is thin, uncertain, or known to drift.

## Existing documents and tickets — `context/sources/`

A project rarely starts from nothing. Functional specifications, business-rule documents, earlier test cases,
bug history, user guides, a glossary — export them and drop them in `context/sources/`, and the
context-builder reads them there. With Jira connected it can also digest the epics and stories you name.

What it writes is the distillation, not the documents: each rule into the *Invariants* of its area's context
document, citing the document and section or the issue key; earlier test cases summarized under *Existing
coverage*; bug history under *Caveats*. The originals stay in `context/sources/`, which is gitignored by
default — raw documents can be large or confidential. Remove that line from `.gitignore` if your team wants
them versioned.

## Provenance matters

Every document states where its knowledge came from, because the three sources have different failure
modes:

- **Read from application source** — accurate now, silently stale after a refactor. Cite the class or
  module so it can be re-checked.
- **Introspected from the database** — accurate about structure, says nothing about intent. Introspection
  tools also misreport things like nullability; confirm anything surprising with a direct query.
- **Observed in the running application** — accurate about behavior, but you only saw the paths you walked.
- **Taken from a document or a ticket** — accurate about intent at the time it was written, silently stale
  once the application or a later ticket changes it. Cite the document and section, or the issue key.

Date each document. A context document with no date and no provenance is a rumor.

## Keeping it honest

Context that has drifted is worse than no context, because an agent will act on it confidently. Two habits:

- When a test fails because reality no longer matches a document here, fix the document in the same change
  as the test.
- `BASELINE.md` carries a "known unknowns" section. Keep it — an agent that knows the boundary of its
  knowledge asks instead of guessing.

## Security

Nothing in this folder is secret, and it is committed to the repository. Connection details, credentials
and tokens belong in `.env`, which is not. If a context document needs to reference a database, name the
database — never the credentials that reach it.

---

The `playwright-context-builder` agent produces the first pass of these documents. It is a draft for you to
correct, not an authority — it knows only what you gave it access to.

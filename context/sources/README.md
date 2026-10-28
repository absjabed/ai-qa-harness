# `context/sources/` — existing documents, for the context-builder to read

Drop exported project documents here before running `/playwright-context-builder`:

- functional specifications and business-rule documents
- existing test cases — spreadsheets, test-management exports
- bug lists and defect history
- user guides, release notes, a glossary of business terms
- Jira issues, when Jira is not connected — a filter or search, then *Export* → CSV, with the description and
  acceptance-criteria columns

**Suggested subfolders** — `npm run prep` creates them: `specs/` (specifications, business rules),
`test-cases/` (existing cases, CSV), `defects/` (bug history, CSV), `jira/` (Jira exports, only when Jira is
not connected), `guides/` (user guides, release notes, glossary). Any layout works; these keep it findable.

**Formats:** Markdown, text, CSV and PDF read best. Export a Word document as PDF, and a spreadsheet as CSV —
one file per sheet that matters.

**What happens to them:** the context-builder reads them and writes the *distillation* into
`context/<area>.md` — rules into *Invariants*, earlier test cases into *Existing coverage*, bug history into
*Caveats* — each citing the file and section it came from. These originals are not what the other agents
read.

**Committed with the QA repo**, so the whole team works from the same documents and a context document can be
re-checked against its source. Never put credentials, personal data or production extracts here — and if a
document is too large or too confidential to commit, keep it outside the repo and give the context-builder
its path instead.

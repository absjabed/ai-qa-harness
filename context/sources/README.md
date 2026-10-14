# `context/sources/` — existing documents, for the context-builder to read

Drop exported project documents here before running `/playwright-context-builder`:

- functional specifications and business-rule documents
- existing test cases — spreadsheets, test-management exports
- bug lists and defect history
- user guides, release notes, a glossary of business terms

**Formats:** Markdown, text, CSV and PDF read best. Export a Word document as PDF, and a spreadsheet as CSV —
one file per sheet that matters.

**What happens to them:** the context-builder reads them and writes the *distillation* into
`context/<area>.md` — rules into *Invariants*, earlier test cases into *Existing coverage*, bug history into
*Caveats* — each citing the file and section it came from. These originals are not what the other agents
read.

**Not committed by default.** Everything here except this file is gitignored: raw documents can be large or
confidential. If your team wants them versioned, remove the `context/sources/` lines from `.gitignore`.
Never put credentials, personal data or production extracts here.

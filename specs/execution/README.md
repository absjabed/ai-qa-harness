# `specs/execution/` — manual test execution

Automated results come from Playwright (`test-results/results.json`). Manual test cases have no runner,
so their outcomes are recorded here — otherwise they are designed, then forgotten, and cycle closure counts
only half the work.

## `manual-results.csv`

One row per manual test case, per cycle.

| Column | Values |
|---|---|
| `TCID` | The case's ID from its plan, e.g. `PROJ-1234-TC007` (I8) |
| `Status` | `Passed` · `Failed` · `Blocked` · `Not Run` |
| `Executed By` | Who ran it |
| `Executed On` | `YYYY-MM-DD` |
| `Environment` | Which environment it ran against |
| `Notes` | What was observed. For `Failed` or `Blocked`, say why — a defect ID if one was raised |

## How rows get here

1. **The planner seeds them.** When it saves a plan, every scenario with Test Type `Manual` gets a row with
   Status `Not Run`. Nothing manual can be silently omitted from a cycle.
2. **A tester updates them** as they execute — change the Status, fill in who, when and where.
3. **`npm run report:cycle` reads them** alongside the automated results. A manual case still `Not Run` at
   closure counts against the "not executed" exit criterion, exactly as an automated one would.

## Starting a new cycle

Either keep one file and overwrite each cycle's results, or copy it to
`manual-results-<release>.csv` at closure to keep a history. The report always reads `manual-results.csv`.

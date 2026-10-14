# `specs/execution/` — what was executed, and the cycle's closure

A test cycle is many runs, not one: the regression, the healer's re-runs of what failed, a retest after a fix,
and the manual cases a person works through over several days. This folder keeps the latest result of every
test case across all of them, so the closure report covers the whole cycle. Everything here is committed.

| File | Written by | What it is |
|---|---|---|
| `automated-results.csv` | every test run, automatically | Each automated test case's latest result |
| `manual-results.csv` | the planner seeds it, a tester fills it in | Each manual test case's result |
| `closure/` | `npm run report:cycle -- --closure` | The cycle's final report, kept for the record |

## `automated-results.csv`

Updated as every run ends (`lib/cycleReporter.ts`): each test case that ran gets its new result; every other
row is kept. You never edit it.

| Column | Values |
|---|---|
| `TCID` | The test case, from the test's title (I8) |
| `Status` | `Passed` · `Failed` · `Flaky` (passed on retry) · `Blocked` (`test.fixme`, a known defect) · `Skipped` |
| `Executed On` | `YYYY-MM-DD HH:MM`, UTC |
| `Browser` | The Playwright project it ran in |
| `Build` | `BUILD_UNDER_TEST` from `.env` at the time — the build of the application that was tested |
| `Spec` | The spec file |

## `manual-results.csv`

One row per manual test case, per cycle.

| Column | Values |
|---|---|
| `TCID` | The case's ID from its plan, e.g. `PROJ-1234-TC007` (I8) |
| `Status` | `Passed` · `Failed` · `Blocked` · `Not Run` |
| `Executed By` | Who ran it |
| `Executed On` | `YYYY-MM-DD` |
| `Environment` | Which environment, and the build, it ran against |
| `Notes` | What was observed. For `Failed` or `Blocked`, say why — the defect's tracker key once it is raised |

1. **The planner seeds the rows.** When it saves a plan, every scenario with Test Type `Manual` gets a row with
   Status `Not Run`. Nothing manual can be silently omitted from a cycle.
2. **A tester updates them** as they execute — change the Status, fill in who, when and where. A case that
   fails: set `Failed`, and have the healer record the defect (see `specs/defects/README.md`).
3. **`npm run report:cycle` reads them** alongside the automated results. A manual case still `Not Run` at
   closure counts against the "not executed" exit criterion, exactly as an automated one would.

## Closing a cycle

1. Write the final report into `closure/` and commit it:

   ```bash
   npm run report:cycle -- --release 2.26 --since 2026-10-01 --closure
   ```

   `--since` is the day the cycle began: anything executed before it — last cycle's results — counts as not
   run, so an old pass cannot close a new cycle.
2. To keep a history of the records too, copy both CSVs to `<name>-<release>.csv` beside them. The report
   always reads the files without a suffix.

## Starting a new cycle

Nothing to clear. Set `BUILD_UNDER_TEST` in `.env` to the new build, and pass the cycle's start date with
`--since` when you report. Reset the manual rows to `Not Run` if you prefer a clean sheet.

# `specs/defects/` — defects found by testing

Everything here is **committed**, so the whole team works from the same defect record: whoever runs the next
regression sees the open defects in its cycle report, and whoever retests a fix finds the entry it belongs to.

| File | Written by | What it is |
|---|---|---|
| `defect-log.json` | the healer, then the defect-raiser | Every confirmed defect and where it is in its life: `pending` → `raised` → `verified` |
| `evidence/<entry id>/` | `npm run defect:evidence` (the healer runs it), or you | The failure's screenshots and page snapshot, attached to the bug when it is raised |
| `defects.csv` | the defect-raiser, only without a Jira connection | Bugs to import into the tracker by hand |

## How a defect moves

1. **The healer** finds a failure it cannot fix, rules out the test-side causes, and asks you to confirm it is
   a defect and its severity. Confirmed → an entry `pending`, and its evidence copied into `evidence/`.
   A defect you find **by hand**, running a manual test case, is recorded the same way — tell the healer the
   test case's TCID and what happened, and put your screenshots in `evidence/<entry id>/`.
2. **The defect-raiser** shows the pending entries, asks which to raise, and creates the bugs in Jira — linked
   to the story, labelled with the TCID, evidence attached — or writes `defects.csv` without Jira. It marks an
   automated test `test.fixme`, so it is skipped visibly rather than failing every run. Entry → `raised`.
3. **When the bug is fixed**, the healer retests it — runs the test twice, or asks you to re-execute a manual
   case. Passes → the test is active again and the entry `verified`.

## Rules

- **Never put personal data here.** Screenshots come from the test environment with QA test accounts; check
  one before committing if a page could show anything else.
- **Two people adding entries at once** produce a merge conflict in `defect-log.json` — keep both entries; an
  entry is never removed or renumbered.
- Traces and videos are large and stay in `test-results/` unless copied with
  `npm run defect:evidence -- --with-traces`.

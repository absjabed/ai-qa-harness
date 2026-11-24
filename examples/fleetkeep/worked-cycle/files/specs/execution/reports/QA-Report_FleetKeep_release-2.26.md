# QA test report — FleetKeep — release 2.26

| Field | Value |
|---|---|
| Release | 2.26 |
| Build under test | demo-1 |
| Environment | localhost:4300 |
| Browsers | chromium, edge |
| Generated | Practice run · 2026-10-14 17:46 UTC |

## Summary

**Exit criteria all met** — 4 of 4 test cases passing, 0 not executed, 0 open defects. This report states facts; whether to close the cycle is a person's decision.

## Tickets

_Each story in scope, with its status in Jira and how its test cases ended._

| Ticket | Title | Jira status | Release | Epic | Passing | Failed | Blocked | Not run | AC passing |
|---|---|---|---|---|---|---|---|---|---|
| FK-1304 | Authorise a vehicle's return to service | — | 2.26 | FK-1301 | 4/4 | 0 | 0 | 0 | 3/3 |

## Exit criteria

_The conditions this project set for closing a test cycle (PROJECT-PROFILE.md section 10)._

| Criterion | Threshold | Actual | Result |
|---|---|---|---|
| Priority 1 test cases passing | 100% | 100% (2/2) | Met |
| Priority 2 test cases passing | 95% | 100% (2/2) | Met |
| Acceptance criteria with a passing test case | 100% | 100% (3/3) | Met |
| Open defects at P1 | ≤ 0 | 0 | Met |
| Open defects at P2 | ≤ 0 | 0 | Met |
| Test cases not executed | ≤ 0 | 0 | Met |

## Results

_How every test case in scope ended — 4 active across 1 story._

| Outcome | Automated | Manual | Total |
|---|---|---|---|
| Passed | 3 | 1 | 4 |
| Flaky | 0 | 0 | 0 |
| Failed | 0 | 0 | 0 |
| Blocked | 0 | 0 | 0 |
| Skipped | 0 | 0 | 0 |
| Not Run | 0 | 0 | 0 |
| **Total** | 3 | 1 | 4 |

## By priority

_Priority 1 is what must work; priority 3 is lower-risk detail._

| Priority | Test cases | Passing | Rate |
|---|---|---|---|
| P1 | 2 | 2 | 100% |
| P2 | 2 | 2 | 100% |
| P3 | 0 | 0 | — |

## Acceptance-criteria coverage

_Each acceptance criterion of each story, and whether a passing test case proves it._

| Story | AC | Test cases | State |
|---|---|---|---|
| FK-1304 | AC1 | FK-1304-TC003 | Passing |
| FK-1304 | AC2 | FK-1304-TC002 | Passing |
| FK-1304 | AC3 | FK-1304-TC001, FK-1304-TC004 | Passing |

## Defects

_Pending: confirmed, not yet filed. Raised: filed in the tracker, still open. Verified: fixed and passed on retest._

| Status | Count |
|---|---|
| pending | 0 |
| raised | 0 |
| verified | 1 |


## Traceability

- Results with no TCID in their title: **0**
- Results whose TCID is in no plan: **0**
- Open defects with no TCID: **0**

## Sign-off

| Role | Name | Date | Decision |
|---|---|---|---|
| Prepared by | Practice run | 2026-10-14 | — |
| Reviewed by |   |   |   |
| Release decision |   |   | Close / Do not close |

## How to read this report

- **Passed** — the test case did what its plan expects.
- **Flaky** — failed once, then passed on retry. It counts as passing, but is worth a look.
- **Failed** — the application did not do what the plan expects, or the test itself needs fixing.
- **Blocked** — set aside because of a known, open defect; it is run again once the defect is fixed.
- **Skipped** — deliberately not run in this selection.
- **Not run** — has not been executed yet: an automated case outside the run, or a manual case not yet done.
- **TCID** — the permanent ID of a test case, e.g. `PROJ-1234-TC002`: the story key, then the case number.

_Record: commit `—` · harness 1.1.0 · automated results 2026-10-14 17:45 to 2026-10-14 17:45 UTC · name from given · formal report._

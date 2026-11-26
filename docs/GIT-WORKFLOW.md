# Git workflow for a project's QA repo

How a QA repo's branches, commits and merges work, so a team never loses a test, a result or a defect to a
merge. **The agents run git; you answer their questions.** Every agent that touches a story follows this file.

## Branches

| Branch | Holds | Created from | Merges into |
|---|---|---|---|
| `main` | The tests for what is live | — | — |
| `develop` | Every finished story's tests | `main`, once | — |
| `release/<x>` | One client release's stories; its regression runs here | the latest `develop`, at the start of the release cycle | `main`, and back into `develop`, when the release closes |
| `test/<KEY>-<short-desc>` | One story's plan, tests, results and defects | the freshly pulled `release/<x>`; `develop` if the story has no release | its base, by pull request |
| `harness/<short-desc>` | A change to the harness itself (the improver's) | `develop` | `develop` |

`<x>` is the client's release — the story's fix version in Jira, `**Release:**` in its plan — never the
harness's version.

**Protect `main`, `develop` and `release/*` on the remote** (GitHub, GitLab, Bitbucket, Azure DevOps all
offer it): no force-push, no deletion, changes by pull request. The rules in `.claude/settings.json` stop an
agent from force-pushing, hard-resetting, deleting branches or rewriting history, but they match commands by
how they start; the remote's protection is what holds whatever is typed.

## `npm run story`

| Command | Does |
|---|---|
| `npm run story -- status [<KEY>…]` | Where each story is — plan, reviews, tests, results, open defects, branches — and whether it may merge. Worked out from the files every time; nothing stored |
| `npm run story -- start <KEY> "<desc>" --release <x>\|none --base <branch> --yes` | The story start protocol, below |
| `npm run story -- start <KEY> --resume --yes` | Back to the story's existing branch, fast-forwarded |
| `npm run story -- switch <branch> --yes` | A clean tree, a fetch, then the branch checked out and fast-forwarded — before a regression |
| `npm run story -- release-start <x> --yes` | `release/<x>` from the freshly pulled `develop`; lists the stories with no release yet |
| `npm run story -- finish <KEY> --yes` | Checks the merge rule, brings the latest base into the story's branch, lists shared files that changed |

Without `--yes`, each shows what it would do and changes nothing. None of them pushes, merges into a shared
branch, deletes a branch or rewrites history.

## The story start protocol

Before **any** work on a ticket — planning, generating, running, healing — the agent:

1. Checks the working tree is clean. Uncommitted changes: it stops and asks you what to do with them.
2. Fetches.
3. Looks for the story's branch. One exists: it offers to resume it, and never starts a second.
4. Asks you for the **base branch**, suggesting `release/<x>` for the story's release, else `develop`. You
   choose every time. `release/<x>` does not exist yet: it offers `release-start` first.
5. Checks out the base and pulls it, fast-forward only. If it has diverged, it stops: a person sorts that out.
6. Creates `test/<KEY>-<short-desc>` and says where things stand.

`npm run story -- start` does steps 1–3, 5 and 6; the agent asks step 4 and runs it with `--base <your
choice> --yes`.

**A story with no release yet** branches from `develop` and merges back into `develop`. The agent says so
before starting, and the story is in no release's regression — `status` and every report list it as *not in a
release yet* — until it is scheduled.

## Commits

One line, no body:

```
<type>(<KEY>): <what changed> [<stage>]
```

| Type | When | Stage, in brackets |
|---|---|---|
| `test-plan` | The planner saves a plan | `planned`, or `plan-reviewed` once its review is clean |
| `test-gen` | The generator writes a spec, page objects, fixtures, data | `tests-generated` |
| `test-review` | The generator records the spec's clean review in the plan | `tests-reviewed` |
| `test-run` | A run's results are recorded | `run` |
| `test-heal` | The healer fixes a test | `healed` |
| `defect` | A defect is recorded, raised, or verified | `defect-recorded`, `defect-raised`, `defect-verified` |
| `test-manual` | Manual results are entered | `manual-done` |
| `test-report` | A formal report is written | `reported` |
| `context` | Context documents change | `context-updated` |
| `harness` | The harness itself changes, on `harness/<desc>` | `harness` |

`context` and `harness` commits have no key: `context: vehicles, defects [context-updated]`. For a release's
regression the key is the release: `test-run(2.26): regression, 41 passed, 2 failed [run]`. A narrow re-run
is committed with its own counts: `test-run(<KEY>): re-run <TCIDs>, 1 passed, 0 failed [run]`. A retest's
`defect-verified` commit holds the spec, the defect entry and the results file, on the branch the spec lives
on — the release branch once the story is merged.
A story put on hold — blocked by a defect or a question — gets a commit ending `[on-hold]`, and its branch is
pushed (asked first) so the work is not only on one machine.

Each agent commits **its own** files at the end of its stage, after saying what it will commit. It never
commits `.env`, `.mcp.json`, `test-results/` or `reports/` — `.gitignore` keeps them out, and it checks.
It commits in the plain one-line `git commit -m` form, from the repo root — no `cd … &&` or `git -C` — and a
refused commit is reported once, never retried in another form.

## When a story merges

**The merge rule:** a story merges into its base once its tests are **generated, reviewed and run** — open
defects and `test.fixme` included. A known bug is a result: the release branch, its regression and its
reports must see every open defect, so a story is not held back until its bugs are fixed.

`npm run story -- finish <KEY>` checks the rule, brings the latest base into the story's branch, and lists the
shared files — page objects, fixtures, data, config — that changed there since the story started. If any
did, the agent offers to re-run the story's tests before going on. Then, each asked first:

1. push the story's branch;
2. open a pull request into the base, titled `test(<KEY>): <title> [ready-to-merge]`;
3. merge it once reviewed — by the team, on the remote.

**Records never conflict.** `specs/execution/automated-results.csv` and `manual-results.csv` merge with
`merge=union` (`.gitattributes`): both sides' rows are kept, and where a test case has two, the scripts read
the newer. Each defect is its own file in `specs/defects/log/`, so two stories add different files. A
conflict anywhere else — a page object both stories changed — is resolved with you, never by picking a side
blindly.

## A story moved to another release

When a story's fix version changes in Jira, the agent says how much is involved first. A small move — the
plan, the spec, a few commits:

1. `**Release:**` in the plan becomes the new release;
2. the spec moves to `tests/stories/<new>/` (`git mv`, asked);
3. the story's commits are brought to a branch from the new `release/<new>`, and its pull request retargeted.

A large move — shared page objects changed, several stories depending on it — the agent stops and asks.

## Closing a release

When the client release ships:

1. a last regression on `release/<x>`, and the closure report (`npm run report:cycle -- --release <x>
   --closure`), committed;
2. a pull request from `release/<x>` into `main`, merged once approved;
3. a pull request from `release/<x>` back into `develop`, so stories started from `develop` meanwhile keep
   every fix.

The agent prepares each step and asks before it; the branch protection on `main` means a person approves.

## Where to start in an existing repo

No `develop` yet: create it from `main` once (`git checkout -b develop main`, push — asked). The first
release cycle then starts with `npm run story -- release-start <x>`.

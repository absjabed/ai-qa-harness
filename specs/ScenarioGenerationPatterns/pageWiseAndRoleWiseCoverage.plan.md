# Scenario Generation Patterns — Page-wise & Role-wise Coverage

Reference doc for the `playwright-test-planner` agent. Consult at Workflow Step 2 (Analyze flows)
whenever a story's feature surfaces on **more than one page** and/or is used by **more than one
role**.

The rules below are application-agnostic — nothing here needs editing per project. They apply whenever
one feature surfaces on several screens, or behaves differently depending on who is looking at it.

## 1. When this pattern applies

A feature warrants page-wise/role-wise replication (rather than one representative scenario set)
when:

- The same UI behavior is implemented on multiple pages sharing a common ancestor or pattern — a
  Create variant and its Update counterpart, or several flavors of the same list.
- Multiple roles can reach the feature and ownership/permission differs meaningfully per role: a
  full-access role acts on anything; an owner role acts only on its own records; a view-only role is
  blocked entirely.

If the underlying mechanism is identical across pages and only the data or entry point differs,
default to **replicate identically**, not "test once and assume parity". Say so explicitly at the
flow-analysis checkpoint rather than silently picking the cheaper option — full replication is the
default this harness assumes, and cutting it is the user's call to make, not the agent's.

## 2. Page-wise replication rule

- Build one **core scenario template** (the AC1–ACn happy-path/edge/negative set) against the
  primary page, then replicate it **identically** — same scenario titles, same step shape, same
  Expected Result shape — against every other affected page, swapping only:
  - the navigation/entry-point `Given` steps,
  - the page-specific fixture and page-object names,
  - the `Data` field's page-specific key.
- Number scenarios sequentially across the whole plan (TC001, TC002, … continuing into the next
  page's block rather than restarting per page) so TCIDs stay globally unique and AC traceability
  stays simple.
- Mark a mirrored block with a one-line note under its module heading, e.g.
  `*(TC033–TC047 mirror TC001–TC015 exactly in intent; only the navigation/entry point and
  page-specific data differ.)*` — keeps the plan scannable without re-explaining every scenario.
- **Create vs Update parity**: where a feature exists on both a Create-flow page and its Update
  counterpart, do not write a standalone "parity" scenario. Parity is proven implicitly by identical
  coverage existing on both sides. Adapt phrasing only where the flow genuinely differs (an empty
  list versus a saved one; "Save" versus "Update").

## 3. Role-wise layering rule

- Run the **full core template** a second time under a different role only where ownership or
  role-specific behavior is actually meaningful for that page. A role with no distinct behavior on a
  page does not earn a full replication.
- For roles needing only a **boundary check**, write a single targeted scenario per page instead of
  the full set:
  - **Outsider/negative access** (a role that owns nothing here): one scenario proving the controls
    are unusable or hidden on a record it does not own.
  - **View-only/no-access role**: one scenario proving the feature does not render for them at all.
- Reuse the suite's **established ownership fixtures** rather than inventing new ones. Grep existing
  specs for how "own record" versus "outsider" accounts are already modeled and stay consistent.
- Cross-check `specs/UserFlowsUserRolePermissions/crossRoleAccessControl.plan.md` for an existing
  permission-matrix row covering this feature. No row yet → these scenarios are establishing it;
  say so in the plan's Scope Notes rather than leaving the gap implicit.
- **Gap-fill across symmetric pages**: if a role or negative-access check exists for one page,
  verify the symmetric page has the matching check. Coverage should not be asymmetric across
  parallel pages just because the story text mentioned only one of them.

## 4. Structure rule — no cross-cutting modules

- Every scenario lives inside exactly one **page module** heading. Do not create separate
  "Role-Based Access Control" or "Error Guessing" modules spanning pages — fold role/permission and
  error-guessing scenarios into the module of the page they were found on.
- Distinguish role-access scenarios within a page module through the Sub Module field, e.g.
  `Sub Module: <Feature> (Create flow) — <Role> Access`, so they filter cleanly without needing a
  separate top-level module.

## 5. Exceptions — don't over-replicate mechanism-only checks

Judge per scenario:

- **Pure-mechanism error guessing** (double-submit guarding against a duplicate write, for
  instance) that does not depend on page-specific data → run it **once**, on one representative
  page, and say so explicitly in Scope Notes.
- **Data- or flow-dependent checks** (sort/filter recalculation, where the available options
  genuinely differ per page) → these **do** need replication, because the thing under test varies by
  page even though the scenario shape looks similar.
- State the reasoning for every exception in Scope Notes. A future reader — or the generator agent —
  should never have to guess why a scenario was not replicated everywhere.

## 6. Self-audit additions for replicated plans

On top of the standard I1–I7 and AC-traceability checks:

- Every page module that should mirror the core template does, at the same scenario count. Flag any
  page with fewer and explain why, per §5.
- Every role needing full-template coverage has it on every page where it is meaningful; every role
  needing only a boundary check has exactly one such scenario per relevant page. No silently skipped
  page/role combination.
- TCIDs are globally sequential, and each AC's traceability line covers the *same relative scenario*
  across all mirrored pages (AC1 → TC001/017/033/051 — the first scenario of each mirrored block),
  so gaps are visible at a glance.

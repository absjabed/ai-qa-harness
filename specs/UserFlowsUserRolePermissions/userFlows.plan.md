# User Flows Test Plan — Index

Navigation click-paths and permission boundaries, one file per role. The `playwright-test-planner`
and `playwright-test-generator` agents read these before tracing a flow through `pages/` from
scratch, so keeping them current saves both agents from re-deriving navigation every run.

Create one file per role in PROJECT-PROFILE.md section 2, from
[`_roleNavigationFlow.template.md`](_roleNavigationFlow.template.md), and list them here.

- [&lt;Role 1&gt; — Core Navigation Flow](role1NavigationFlow.plan.md)
- [&lt;Role 2&gt; — Core Navigation Flow and Permission Boundaries](role2NavigationFlow.plan.md)
- [Cross-Role Access Control](crossRoleAccessControl.plan.md)

## Application Overview

`<One paragraph: what the application does, which roles exist, and what these plans do and do not
cover. State explicitly what is covered elsewhere — deep list/filter/sort behavior usually lives in
module-wise specs, and these plans should chain the click-paths connecting pages rather than
re-deriving that.>`

All scenarios reference `data/testData.ts` keys (never a literal business identifier), credentials
from `data/auth_data.ts`, Page Factory fixtures from `lib/BaseTest.ts`, no hardcoded assertion
values, and `appConfig` for the base URL — per the Test Authoring Invariants (I1–I7).

Implemented in `<tests/...spec.ts>`.

## Permission boundaries

Each role file has a "Permission Boundaries" section listing what that role can and cannot do,
tied to the specific page-object method that enforces or asserts each restriction. For a side-by-side
view across all roles, see the **Role Permission Matrix** in
[crossRoleAccessControl.plan.md](crossRoleAccessControl.plan.md).

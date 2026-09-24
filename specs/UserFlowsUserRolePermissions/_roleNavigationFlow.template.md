# `<Role>` — Core Navigation Flow Test Plan

> Template. Copy to `<role>NavigationFlow.plan.md` — one per role in PROJECT-PROFILE.md section 2 —
> and delete this line.

## Application Overview

`<What this role's journeys look like end to end, and what this plan deliberately does not
re-derive. Name the click-path chain the plan covers, e.g. dashboard → group → record list →
record detail → logout.>`

All scenarios reference `data/testData.ts` keys, credentials from `data/auth_data.ts`, existing Page
Factory fixtures from `lib/BaseTest.ts` (new page objects flagged explicitly), no hardcoded
assertion values, and `appConfig` for the base URL — per invariants I1–I8.

## Permission Boundaries — `<Role>`

`<One or two sentences positioning this role against the baseline role from PROJECT-PROFILE.md
section 2: full access, owner-scoped, or view-only.>`

**Can do:**
- `<Action>` — via `<fixture>.<method>()`
- `<Action>` — via `<fixture>.<method>()`

**Cannot do:**
- `<Restricted action>` — asserted by `<fixture>.<assertionMethod>()`
- `<Restricted action>` — asserted by `<fixture>.<assertionMethod>()`

**Gaps — not yet automated:**
- `<Behavior that is real but has no page-object method to assert it. Flag per I1/I2 rather than
  writing a scenario that cannot be implemented. Note whether the blocker is a missing method or an
  application defect.>`

## Test Scenarios

**Seed:** `tests/seed.spec.ts`

### 1. `<Role>` — Core Navigation Flow

#### 1.1. `<Role>` navigates `<A>` → `<B>` → `<C>`

**File:** `tests/<target>.spec.ts`

**Fixtures:** `<loginPage>`, `<dashboardPage>`, `<...>`

**Steps:**
1. `<Plain-English action first; the page-object method trailing in parens, e.g. "Log in as the
   role's default user (userLogin with defaultUsers.<role>)">`
2. `<...>`

**Expected:** `<What is visible and true afterwards, specific enough for a zero-context reader to
judge pass/fail — the exact screen, wording, or state change.>`

#### 1.2. `<Role>` is blocked from `<restricted area>`

**File:** `tests/<target>.spec.ts`

**Fixtures:** `<...>`

**Steps:**
1. `<...>`

**Expected:** `<The specific control that is absent or disabled, and where.>`

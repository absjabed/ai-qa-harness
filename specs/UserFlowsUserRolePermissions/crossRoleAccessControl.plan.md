# Cross-Role Access Control Test Plan

## Application Overview

Confirms that direct-URL navigation into another role's area is denied and redirects the user back
to their own landing page — a lightweight negative/security check that is not role-specific
navigation but spans roles. All scenarios reference credentials from `data/auth_data.ts` and
`appConfig` for the base URL, per invariants I1–I7.

## Role Permission Matrix

The consolidated view of the boundaries documented in each role's own plan file. Build one row per
capability, one column per role in PROJECT-PROFILE.md section 2. Each role's own file holds the
scenario and page-object method behind a cell.

Cell values:

- **Yes** / **No** — the application's actual, verified behavior.
- **not yet automated** — the behavior is real but no page-object method exists to assert it
  (flagged per I1/I2 in the relevant role file).
- **not tested here** — a method exists, but this set of navigation plans does not call it.

| Capability | `<Role 1>` | `<Role 2>` | `<Role 3>` |
|---|---|---|---|
| `<Reach the main dashboard>` | Yes | Yes | No — redirected |
| `<Create a record>` | Yes | No (`<method>`) | No (`<method>`) |
| `<Edit a record they own>` | Yes | Yes | No (`<method>`) |
| `<Edit a record owned by someone else>` | Yes | No (`<method>`) | No (`<method>`) |
| `<Delete a record>` | Yes | No (`<method>`) | No (`<method>`) |
| `<Reach the admin console>` | No | No | Yes — exclusive |

`<One line on how "own" versus "other" applies — which roles have an ownership distinction at all,
and which are view-only across the board.>`

**Recurring automation gaps** — behaviors that are real but unassertable today, flagged per I1/I2 in
each role's file rather than repeated in full here:

1. `<Gap, and whether the blocker is a missing page-object method or an application defect.>`
2. `<...>`

**Coverage gaps to be aware of:** `<Which role/capability combinations are assumed rather than
verified, and what would need to be written to close the assumption. State these explicitly — an
untested assumption recorded as a "No" in the matrix above reads as verified fact to the next
person.>`

## Test Scenarios

**Seed:** `tests/seed.spec.ts`

### 1. Direct-URL access is denied across roles

#### 1.1. `<Role>` is redirected away from `<other role's landing URL>`

**File:** `tests/accessControl.spec.ts`

**Fixtures:** `<loginPage>`, `<dashboardPage>`

**Steps:**
1. Log in as `<role>` (`userLogin` with `defaultUsers.<role>`)
2. Navigate directly to `<the other role's landing path, relative to BASE_URL>`

**Expected:** `<Where the user actually lands, and what proves it — the specific heading or control
on their own landing page, not just the URL.>`

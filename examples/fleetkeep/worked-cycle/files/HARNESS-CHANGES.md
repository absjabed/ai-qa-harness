# Harness changes in this QA repo

Every change this QA repo makes to its own copy of the harness — an agent's instructions, the templates, the
guard rails, the scripts — with why it was made and how to check it. `/playwright-harness-improver` writes an
entry for each change it makes, and for each problem the team only wants noted. Add one yourself if you
change a harness file by hand.

It answers the questions that come up later: why does this copy behave differently from the template, did
that fix actually work, and which of our changes would help other projects too. Project facts — roles,
rules, data, the profile's own content — are not harness changes; they change all the time and live in
`PROJECT-PROFILE.md` and `context/`.

Newest first. Each entry:

```markdown
## <YYYY-MM-DD> — <one-line summary>

- **Problem:** <what happened, what was expected>
- **Cause:** <the layer and file, and why>
- **Change:** <what changed, in which files — docs included>
- **Check:** <how to confirm it; and once someone has, the date and result>
- **Status:** applied · verified · reverted · noted
- **Upstream:** yes — <why it would help any project> · no — <why it is this project's own>
- **Protections:** none · <which protection changed, and who agreed>
```

---

## 2026-10-14 — Reset the demo data before each return-to-service test

- **Problem:** FK-1304-TC001 passed in Chromium and failed in Edge: "FK21 ABC can't return to service:
  category-A defect DEF-0003 is not closed." TC003 had left an open category-A defect on the same vehicle.
- **Cause:** Project facts — `data/seed.ts` was still the template's empty database version, and the
  harness resets once per run, not per test.
- **Change:** `data/seed.ts` resets through the demo app's `/__reset` endpoint; the FK-1304 spec calls
  `resetTestData()` in a `beforeEach`.
- **Check:** `npm run regression -- --release 2.26 --yes` — 6 of 6 passed on both browsers, 2026-10-14.
- **Status:** verified
- **Upstream:** partly — the endpoint is this app's own; the guidance (reset through the app, per-test
  reset where tests share records) went into the template's workflow 10 and `data/seed.ts` (8d14061).
- **Protections:** none

## 2026-10-14 — The example test logs in as the baseline role

- **Problem:** `tests/example.spec.ts` failed with "Credentials for role 'admin' are not configured" after
  the roles were set to driver, transportManager and technician.
- **Cause:** Scripts and config — the example used `defaultUsers.admin`, a template example role.
- **Change:** `defaultUsers.baseline`, derived from `baselineRole`; the database example skips when
  database validation is out of scope.
- **Check:** `npx playwright test tests/example.spec.ts` — the wiring check passes; 2026-10-14.
- **Status:** verified
- **Upstream:** yes — any project renames the roles. Applied upstream in 8d14061.
- **Protections:** none

## 2026-10-14 — The signed-in check proves a login, and sign-out works without a menu

- **Problem:** a login file passed with a wrong password: `expectLoggedIn()` accepted any heading, and the
  login screen has one. `Logout` assumed a profile menu FleetKeep does not have.
- **Cause:** Scripts and config — `pages/DashboardPage.ts` and `pages/common/Logout.ts`.
- **Change:** `DashboardPage.signedInMarker` (the Sign out button here) is what `expectLoggedIn()` checks;
  `logout()` opens the menu only when the sign-out control is not already visible.
- **Check:** `DRIVER_PASSWORD=wrong npx playwright test tests/seeds/driver.spec.ts` fails with "Not signed
  in…"; with the right password all three login files pass. 2026-10-14.
- **Status:** verified
- **Upstream:** yes — the weak check would let every project's login files pass falsely. Applied upstream
  in 8d14061.
- **Protections:** none


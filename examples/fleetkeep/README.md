# FleetKeep — a practice app and a worked example

A small, fictional fleet-maintenance app to learn the harness on before your real project, and one ticket
taken through its whole testing cycle against it. FleetKeep is the same fictional product as the BA
harness's worked example; nothing here describes a real application, company or person.

`npm run export` never copies `examples/` into a project's QA repo. You build a practice repo from it on
purpose, with `--example`.

## What is here

| Folder | What it is |
|---|---|
| [`demo-app/`](demo-app/README.md) | The app: drivers report vehicle defects, the transport manager triages them and raises job cards, technicians fix them, and a vehicle returns to service only when every category-A defect on it is closed. `node server.js`, no install. **One defect is planted** — [`KNOWN-DEFECT.md`](demo-app/KNOWN-DEFECT.md) says what; don't read it until you have tried to find it. |
| `qa-setup/` | A practice QA repo's setup, as changes on top of an export: the three roles and a login file each, the login, signed-in and sign-out selectors, the demo data reset through the app, profile section 1, and `.env.example` filled with the demo accounts. |
| `worked-cycle/` | What one ticket's full cycle left behind, on top of `qa-setup`: FK-1304's plan and spec, the page objects and fixtures it needed, the results record, the planted defect logged with its screenshot, raised as a CSV bug and verified after the fix, the release 2.26 closure report, and `HARNESS-CHANGES.md` entries. |

Both layers are lists of changes (`overlay.json`) plus the project's own new files — never copies of harness
files — so they keep up as the template improves. `npm run check` fails if a template change stops one
applying.

## Practise

**1. Start the app**, in its own terminal, from the template:

```bash
node examples/fleetkeep/demo-app/server.js
```

It listens on `http://localhost:4300`. `POST /__reset` — or a restart — puts the demo data back. Later, to
practise the retest once a defect is "fixed", restart it with `FLEETKEEP_FIXED=true`.

**2. Build a practice repo** — outside the template, in a new folder:

```bash
npm run export -- ../fleetkeep-practice --example fleetkeep
```

then, in that folder:

```bash
npm install
npx playwright install
npx playwright test tests/seeds/
```

All three login files should pass. `.env` was written for you from `.env.example`, with the demo accounts.

**3. Take a ticket through the cycle** with the agents, as [the walkthrough](../../docs/qa-harness-walkthrough.html)
describes: `/playwright-context-builder` first, then a ticket — FK-1304, *Authorise a vehicle's return to
service*, is a good first one:

- **AC1** — Only a transport manager can return a vehicle to service.
- **AC2** — A vehicle cannot return to service while any category-A defect on it is not closed.
- **AC3** — Once every category-A defect on it is closed, the transport manager can return the vehicle to
  service; it shows as Roadworthy and the audit trail records it.

Paste it into the planner with its key, `FK-1304`, release `2.26`, epic `FK-1301`. A good plan catches the
planted defect, the generated test fails on it, the healer refuses to change what the test expects, and the
defect-raiser files it.

**4. Compare** with what the worked cycle produced:

```bash
npm run export -- ../fleetkeep-worked --example fleetkeep --worked
```

The worked cycle was written by hand in the agents' format, for the scripts' practice run — every script ran
for real against the app, but no agent wrote it. Treat it as the shape to expect, not as the agents' output. It was finished after the defect was fixed, so run it against the fixed app:
`FLEETKEEP_FIXED=true node examples/fleetkeep/demo-app/server.js`. Against the app as shipped, TC002 fails —
that is the planted defect.

## The demo accounts

| Role key | Who | Email | Password |
|---|---|---|---|
| `driver` | Dana Driver — assigned FK21 ABC and FK22 DEF | `dana.driver@fleetkeep.test` | `Drive-Demo-1` |
| `transportManager` | Theo Manager — full access, the baseline role | `theo.manager@fleetkeep.test` | `Manage-Demo-1` |
| `technician` | Tess Technician — works job cards | `tess.tech@fleetkeep.test` | `Fix-Demo-1` |

They are committed on purpose, in this README and in the practice repo's `.env.example`, because they open
nothing but this local demo. A real project never puts credentials in `.env.example` or anywhere else in git.

## Keep the planted defect from the agents

The agents in a practice repo cannot see `examples/` — it is not copied. Don't paste `KNOWN-DEFECT.md`, the
worked cycle's defect log or its plan into the conversation while practising; finding the defect is the
exercise.

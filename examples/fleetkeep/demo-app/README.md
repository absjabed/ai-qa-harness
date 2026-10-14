# FleetKeep demo app

A small, fictional fleet-maintenance web app to practise the AI QA harness against. It implements a slice
of the FleetKeep example from the BA harness: drivers report defects from walkaround checks, the transport
manager triages them and raises job cards, technicians fix them, and a vehicle returns to service only
when every category-A defect on it is closed.

```bash
node server.js          # http://localhost:4300 — no install needed
```

All data is in memory. Restart the server, or `POST /__reset`, to get the seed data back.
`GET /health` answers `ok`.

`FLEETKEEP_FIXED=true node server.js` runs it with the planted defect fixed — for practising a retest, and for
running the worked cycle, which was finished after the fix.

## Test accounts — demo values only

| Role key | Who | Email | Password |
|---|---|---|---|
| `driver` | Dana Driver — assigned FK21 ABC and FK22 DEF | `dana.driver@fleetkeep.test` | `Drive-Demo-1` |
| `transportManager` | Theo Manager — full access | `theo.manager@fleetkeep.test` | `Manage-Demo-1` |
| `technician` | Tess Technician — works job cards | `tess.tech@fleetkeep.test` | `Fix-Demo-1` |

These exist only in this local demo, and are committed on purpose — in this README and in the practice repo's
`.env.example`. Never reuse them anywhere else, and never commit a real application's credentials.

## Pages

- Signed out: `/login`, `/forgot-password`
- Signed in: Dashboard, Vehicles, Defects, a defect's page with the actions the role may take, Report a
  defect (driver), Audit trail (transport manager)

`KNOWN-DEFECT.md` describes the one bug planted for the practice run. Keep it away from the agents — the
point is to see whether the harness finds it.

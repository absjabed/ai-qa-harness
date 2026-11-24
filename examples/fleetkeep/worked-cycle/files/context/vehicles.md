# Vehicles — context for QA

> FleetKeep · QA context · vehicles · 2026-10-14

A vehicle is either Roadworthy or VOR (vehicle off road). A category-A defect reported on it takes it off the
road at once; it comes back only when the transport manager returns it to service, and only once every
category-A defect on it is closed. Test authors need this for any story that reports, works or closes a defect,
because the vehicle's status moves with them.

**Provenance:** the FleetKeep BA example's business rules (BR-003, BR-018, BR-019, BR-020), observed in the
running demo app (Vehicles, Defects and Audit trail pages), and story FK-1304. Practice repo — written by hand
in the context-builder's format.

**Scope:** the local demo app only. Its data is in memory; `POST /__reset` restores the seed data.

---

## Quick reference

| Screen | Purpose | Key fields |
|---|---|---|
| Vehicles | Every vehicle and its status; the transport manager's Return to service action | Registration, Status (`Roadworthy` / `VOR`) |
| Defects, a defect's page | The defect and the actions the signed-in role may take | ID, Category (A/B/C), Status |
| Audit trail | Who did what, newest first — transport manager only | Who, What, When |

## Invariants

1. A category-A defect sets its vehicle to VOR as soon as it is reported. — source: BR-003
2. Only a transport manager can return a vehicle to service; other roles are not offered the action. — source:
   BR-018 · verified: FK-1304-TC003, 2026-10-14
3. A vehicle returns to service only when every category-A defect on it is Closed; Resolved is not enough. —
   source: BR-019 · verified: FK-1304-TC002, 2026-10-14
4. Every return to service is written to the audit trail with who did it. — source: observed (Audit trail
   page)

## States and transitions

| From | To | Trigger | Allowed for |
|---|---|---|---|
| Roadworthy | VOR | a category-A defect is reported on it | driver, on their own vehicle (BR-004) |
| VOR | Roadworthy | Return to service, every category-A defect Closed | transport manager |

## Caveats

- The escalation clock on an open category-A defect (BR-020) has not been explored; FK-1304 left it out of
  scope.

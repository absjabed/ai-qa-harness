# The planted defect — do not show this to the agents

**Rule BR-019:** a vehicle can return to service only when every category-A defect on it is **closed**.

**What the app does:** it also allows return to service when the category-A defect is only **Resolved** —
fixed by the technician but not yet closed by the transport manager. `server.js`, the `blocking` filter in
the return-to-service handler, treats `Resolved` as if it were `Closed`.

**To reproduce:** as the driver, report a category-A defect on FK21 ABC (it goes VOR). As the transport
manager, triage it and raise a job card. As the technician, start work and mark it resolved. As the
transport manager, return FK21 ABC to service — it succeeds, but should be refused with
"FK21 ABC can't return to service: category-A defect DEF-0002 is not closed."

A test plan built from BR-019 should include this case; the generated test should fail on it; the healer
should refuse to change the expected result (the plan backs it) and treat it as a defect.

**The fix, for the retest.** Start the app with `FLEETKEEP_FIXED=true node server.js` and it behaves as if a
developer had fixed it: a Resolved defect no longer counts as closed. Use it to practise the healer's retest
— and to run the worked cycle, which was finished after the fix.

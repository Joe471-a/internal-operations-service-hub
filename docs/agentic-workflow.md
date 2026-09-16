# Agentic Workflow

## 1. UNDERSTAND

**Week 2 milestone - what was built then:** the request lifecycle - changing
a request's status, and rejecting changes the rules don't allow. In-memory
only, no frontend, no database, no authentication.

**From data model**:
- statuses (product-spec.md): Submitted, Assigned, In Progress, Completed, Denied
- rules (data-model.md + images/lifecycle.png):
  - Submitted -> Assigned or Denied
  - Assigned -> In Progress
  - In Progress -> Completed
  - Completed and Denied are final - cannot change

**Code:** `backend/src/requests/` (data, rules, service, controller, module)

**v0.3 milestone - what was added on top:** the same lifecycle, now behind a
real stack instead of a demo. A React frontend, Prisma/SQLite persistence
(decisions/ADR-003.md), an actor-header authorization mechanism
(`backend/src/requests/actors.ts`) with two real rules - only the lead of a
request's own department may assign or deny it, and only that
department's staff/lead (or whoever submitted it) may view its history - a
rejected-on-purpose invalid request (missing title / bad department), an
expected-on-purpose failure (acting on a terminal request), and all four
kinds of test coverage plus one end-to-end test. See
`docs/full-stack-delivery.md` for the full contract and test results.

**Still not here:** real authentication (the `x-hub-actor` header is a
teaching stand-in, not a login - see docs/architecture.md), CI/CD,
deployment, monitoring. Out of scope per the assignment brief, not
forgotten.


## 2. DIRECT

How I steered the AI agent — the four points from the milestone, applied
twice now (Week 2, then again for v0.3):

- **Bounded task + relevant context:** Week 2 was one behaviour, pointed at
  the Week 1 docs. v0.3 was a much bigger brief, so before writing anything
  the agent read this repo's own docs *and* a sibling reference project
  (`shoplite-academy-2026`) to copy its conventions - file layout, the
  actor-header auth pattern, the three-tier test style - rather than invent
  new ones.
- **Inspect before modifying:** same discipline both times - it read the
  relevant files and showed its understanding before writing code.
- **Plan before execution:** for v0.3 it entered plan mode, drafted a
  14-step plan, and I made it implement and verify each step on its own
  before starting the next, rather than doing the whole thing in one sweep.
- **Approve · Redirect · Stop** (v0.3 examples):
  - Approved: mirroring shoplite's file/test structure; the Prisma schema;
    keeping read endpoints open while only gating writes.
  - Redirected: the assign/deny buttons were first only shown to actors who
    could plausibly use them - which meant the *denied* case could never
    actually be clicked in the browser. Changed to always show the button
    and let the backend refuse, matching shoplite's own pattern, so both
    outcomes of the authorization rule are demonstrable by a real click.
  - Redirected again: the history-view feature was first proposed open to
    any staff/lead; redirected twice - once to scope it to the actor's own
    department plus their own submissions, once to show real names instead
    of raw actor ids.
  - Stopped: on a frontend blank-screen bug and a couple of IDE-only
    tangents, until each was root-caused with actual evidence (hashes,
    screenshots, a live browser check) instead of assumption.


## 3. PROVE

**Claim:** valid status changes work, invalid ones are rejected, a Completed
request cannot change.

**Run:**
```bash
npm test
```

**Result:** all checks pass - `backend/src/requests/requests.rules.test.ts` proves
the claim directly, and `requests.integration.test.ts`'s "regression: the
original request lifecycle still holds" block re-proves the same cases
against the real database once the v0.3 milestone added Prisma and
authorization on top.

| Case | Expected | Actual |
|---|---|---|
| Submitted -> Assigned | allowed | allowed |
| Assigned -> In Progress | allowed | allowed |
| Submitted -> Completed (skips a step) | 409 rejected | 409 rejected |
| status "Banana" | 400 rejected | 400 rejected |
| Completed -> In Progress | 409 rejected (terminal) | 409 rejected (terminal) |
| unknown id | 404 | 404 |

No bugs found in the lifecycle logic. The original manual smoke script for
this milestone (`backend/verify.mjs`) has since been retired - these became
real automated tests instead of something to run and read by hand.

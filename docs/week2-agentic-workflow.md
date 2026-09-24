# Agentic Workflow

> **Note:** this document records the Week 2 milestone as it was built - an
> in-memory backend with no frontend, database or authentication. The project
> has since grown past that (database and frontend in v0.3, AI intake in v0.4,
> real login afterwards), so details here may no longer describe the running
> app. See [README.md](../README.md) for the current state and
> [extra.md](extra.md) for the login and visibility changes.

## 1. UNDERSTAND

**Week 2 milestone - what was built:** the request lifecycle - changing
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

**Non-goals:** frontend / real database / auth / full test suite are not
required this week.


## 2. DIRECT

How I steered the AI agent — the four points from the milestone:

- **Bounded task + relevant context:** one behaviour, pointed at the Week 1
  docs.
- **Inspect before modifying:** it read the relevant Week 1 files and showed
  its understanding before writing any code.
- **Plan before execution:** the agent broke the milestone into nine
  sequential steps, each scoped narrowly, and paused after each one for
  confirmation before starting the next.
- **Approve · Redirect · Stop:**
  - Approved: the project layout, the endpoint shapes.
  - Redirected: to mirror a reference project's data/service/controller
    structure, and to use an npm workspace.
  - Stopped: one step was reverted in full and rebuilt one file at a time
    for closer review.


## 3. PROVE

**Claim:** valid status changes work, invalid ones are rejected, a Completed
request cannot change.

**Run (at the time):** `backend/verify.mjs`, via `npm run verify` - a manual
script, not the automated test suite that exists today. It built the app,
started it, and ran the cases below against the live server.

**Result:** all cases passed when run. The script has since been retired
(replaced by real automated tests at the v0.3 milestone - see
`docs/week3-full-stack-delivery.md`) and its exact console output was not
preserved; the table below reflects what it checked and confirmed at the
time, not a re-run of the original evidence.

| Case | Expected | Actual |
|---|---|---|
| Submitted -> Assigned | allowed | allowed |
| Assigned -> In Progress | allowed | allowed |
| Submitted -> Completed (skips a step) | 409 rejected | 409 rejected |
| status "Banana" | 400 rejected | 400 rejected |
| Completed -> In Progress | 409 rejected (terminal) | 409 rejected (terminal) |
| unknown id | 404 | 404 |

No bugs found in the lifecycle logic.

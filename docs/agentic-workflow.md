# Agentic Workflow

## 1. UNDERSTAND

**What I built:** the request lifecycle - changing a request's status, and
rejecting changes the rules don't allow.

**From data model**:
- statuses (product-spec.md): Submitted, Assigned, In Progress, Completed, Denied
- rules (data-model.md + images/lifecycle.png):
  - Submitted -> Assigned or Denied
  - Assigned -> In Progress
  - In Progress -> Completed
  - Completed and Denied are final - cannot change

**Code:** `backend/src/requests/` (data, rules, service, controller, module)

**Not this week:** frontend, database, authentication, departments/staff. In-memory storage only.


## 2. DIRECT

How I steered the AI agent — the four points from the milestone:

- **Bounded task + relevant context:** one behaviour only (the request lifecycle),
  pointed at the Week 1 docs and the milestone slides.
- **Inspect before modifying:** it read every Week 1 file and showed its
  understanding before writing any code.
- **Plan before execution:** it gave a numbered plan and stopped after each step
  for me to check.
- **Approve · Redirect · Stop:**
  - Approved: the npm workspace, the endpoints, and changing the transition response from `201` to `200`.
  - Redirected: to match the ShopLite `data` / `service` / `controller` structure.
  - Stopped: after Step 2 I told it to revert everything and redo it one file at a time.


## 3. PROVE

**Claim:** valid status changes work, invalid ones are rejected, a Completed
request cannot change.

**Run:**
```bash
npm run verify
```

**Result:** all checks pass.

| Case | Expected | Actual |
|---|---|---|
| Create a request (POST /requests) | 201 Created | 201 Created |
| Submitted -> Assigned | 200 OK | 200 OK |
| Assigned -> In Progress | 200 OK | 200 OK |
| Submitted -> Completed | 409 rejected | 409 rejected |
| status "Banana" | 400 rejected | 400 rejected |
| Completed -> In Progress | 409 rejected | 409 rejected |
| unknown id | 404 | 404 |

No bugs found in the lifecycle logic.

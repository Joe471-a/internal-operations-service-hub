# Full-Stack Delivery (v0.3)

One narrow, user-facing Service Request flow, end to end: React frontend,
NestJS backend, real Prisma/SQLite persistence, behind the explicit API
contract below. Builds directly on the Week 2 request-lifecycle milestone
(see `docs/agentic-workflow.md`) - the state machine is unchanged, everything
around it is new.

## The flow

Three roles, each a superset of the one before (from `docs/data-model.md`'s
"Set by" column):

| Role | Can do |
|---|---|
| Employee | Submit a request, to any department |
| Department Staff | Submit + handle their own department's requests (Assigned -> In Progress -> Completed) |
| Department Lead | Submit + handle + assign or deny their own department's requests (Submitted -> Assigned / Denied) |

Departments: `IT`, `HR`, `FINANCE`. Identity is carried by a header
(`x-hub-actor`), resolved against a fixed actor list
(`backend/src/requests/actors.ts`) - a teaching stand-in for real
authentication, not authentication itself (see `docs/architecture.md`).

A user journey through it: an employee submits a request describing a
problem and picks a department; that department's lead sees it, and either
assigns it (into that department's work) or denies it; once assigned, a
staff member or the lead moves it to In Progress and then Completed; anyone
entitled to see it (see the authorization rules below) can pull up its full
history at any point.

## API contract

All four endpoints live in `backend/src/requests/requests.controller.ts`.
`RequestResult` (the shape returned by all of them) is `{ id, title,
description, department, currentStatus, submittedBy, lastUpdated, history:
[{ status, occurredAt, actorId }] }`.

### `GET /requests`
System-wide list. `?department=IT` and/or `?status=SUBMITTED` filter it (the
"department work queue" access pattern from `docs/data-model.md`). No actor
header required - listing is open to anyone.

| Response | When |
|---|---|
| 200, `RequestResult[]` | always, possibly empty |
| 400 | `department` or `status` given but not a real value |

### `GET /requests/:id`
One request and its full history.

| Header | Required | Meaning |
|---|---|---|
| `x-hub-actor` | yes | who is asking |

| Response | When |
|---|---|
| 200, `RequestResult` | actor is allowed to view this request |
| 401 | header missing, or not a known actor |
| 403 | actor is known but not allowed to view this one (see the view-history rule below) |
| 404 | no request with that id |

### `POST /requests`
Create a request. Starts in `SUBMITTED`.

Body: `{ "title": string, "description": string, "department": "IT"|"HR"|"FINANCE" }`
Header: `x-hub-actor` (required - who is submitting)

| Response | When |
|---|---|
| 201, `RequestResult` | well-formed, known actor |
| 400 | missing/empty `title` or `description`, or an invalid `department` |
| 401 | header missing, or not a known actor |

### `POST /requests/:id/transition`
Move a request to a new status.

Body: `{ "to": "SUBMITTED"|"ASSIGNED"|"IN_PROGRESS"|"COMPLETED"|"DENIED" }`
Header: `x-hub-actor` (required - who is asking)

| Response | When |
|---|---|
| 200, `RequestResult` | legal transition, actor allowed to make it |
| 400 | `to` is not a real status |
| 401 | header missing, or not a known actor |
| 403 | actor not allowed to make this specific move (see the assign/deny rule below) |
| 404 | no request with that id |
| 409 | request is terminal (Completed/Denied), or the transition isn't a defined one from its current status |

## The authorization rule (allowed + denied)

**Assign/Deny gate** (`requests.service.ts`'s `authorizeTransition`, backed
by `actors.ts`'s `can()` + `inSameDepartment()`): only the Department Lead
of a request's own department may move it `SUBMITTED -> ASSIGNED` or
`SUBMITTED -> DENIED`.

- **Allowed**: the IT Lead assigns (or denies) an IT request.
- **Denied**, refused before anything is written: the HR Lead (wrong
  department), IT Staff (right department, wrong role), or an unknown actor,
  attempting the same thing on that IT request.

A second rule went in alongside it, not required by the brief but requested
during the build and covering a query pattern your own `data-model.md`
already called for ("employee_id -> requests"): **the view-history gate**
(`canViewHistory` in `actors.ts`) - anyone may view a request they submitted
themselves; beyond that, an employee may view nothing else, while staff/lead
may additionally view any request in their own department.

- **Allowed**: the IT Lead views an IT request they didn't submit (own
  department); an employee views a request they submitted, in any
  department.
- **Denied**: the HR Lead views an IT request they had no part in; an
  employee views a colleague's request.

## Invalid request rejected on purpose

`POST /requests` with a missing `title` (or `description`), or a
`department` that isn't `IT`/`HR`/`FINANCE`, is rejected with `400 Bad
Request` before anything is written.

## Expected failure handled on purpose

Acting on a request that is already terminal (`COMPLETED` or `DENIED`), or
requesting a transition that isn't defined from its current status (e.g.
skipping a step), is rejected with `409 Conflict` - the same lifecycle
invariant enforced since Week 2 (`requests.rules.ts`'s `checkTransition`),
now reached through the full authenticated/authorized path instead of an
open in-memory endpoint.

## Tests

28 automated backend tests (`npm test`, ~1.5s) across three files, plus one
end-to-end test (`npm run test:e2e`):

| File | Tests | Proves |
|---|---|---|
| `requests.rules.test.ts` | 7 | **The business-rule test.** The lifecycle state machine on its own - valid chain, terminal-state rejection, skipped/backwards-step rejection, malformed status rejection. |
| `requests.service.test.ts` | 14 | **The authorization test (allow + deny).** Both rules above, against a fake Prisma that records writes - every denial is also checked to have written nothing. Plus the invalid-request-on-create cases. |
| `requests.integration.test.ts` | 7 | **The backend+database integration test, and regression protection.** Real `PrismaService` against a disposable copy of the dev database: an assign is read back independently after the fact; a denied attempt leaves the row byte-for-byte unchanged; a "regression" block re-proves the exact Week-2 lifecycle claims (full valid chain, terminal 409, bad status 400, unknown id 404) now running through Prisma + authorization instead of the old in-memory array. |
| `e2e/assign-request.spec.ts` | 1 | **The end-to-end test.** A real browser against the real running stack: an employee submits a request through the actual form, the HR Lead is refused assigning it (error banner shown, status unchanged on screen), the IT Lead then succeeds (status updates on screen). Proves the whole chain - UI, API, authorization, lifecycle rule, SQLite - is actually wired together, not just individually correct. |

## Out of scope for this milestone

Per the assignment brief: no external integration (none of this flow needs
one), no runtime AI/RAG/MCP, no CI/CD, no deployment, no production
infrastructure, no monitoring. Real authentication (replacing the
`x-hub-actor` header with an actual identity provider) is noted as a future
consideration in `docs/architecture.md`, not forgotten here.

## How to verify

See `README.md` for the full install/run/try/test walkthrough. Short
version:

```bash
npm install
npm run db:setup --workspace backend
npm run dev          # backend :3000, frontend :5173
npm test              # 28 backend tests
npm run test:e2e       # the browser test
```

# Internal Operations Service Hub

A company-internal system for requesting and tracking help from departments such as IT, HR, and Finance.

## Overview

The Internal Operations Service Hub is designed to provide one centralized
place where employees can submit requests to departments such as IT, HR,
and Finance and track their progress.

Department staff can view and handle requests related to their department.

## Current Version

**v0.1 - Product Foundation**

This version focuses on defining:

- Product requirements
- System architecture
- Data model
- Major architecture decisions

**The current architecture and technical decisions are not final and may change as requirements become clearer.**

---

## Working Implementation

**v0.2 - Request Lifecycle** added a small in-memory NestJS backend for the request lifecycle only - no frontend, database, or authentication yet (see [docs/agentic-workflow.md](docs/agentic-workflow.md)).

**v0.3 - Integrated Product Slice.** A full, narrow Service Request flow:
React frontend, NestJS backend, real persistence (Prisma/SQLite), an
authorization rule, and automated tests at every level. Full contract and
test results: [docs/full-stack-delivery.md](docs/full-stack-delivery.md).
How it evolved from the Week 2 in-memory milestone:
[docs/agentic-workflow.md](docs/agentic-workflow.md).

No external accounts, no Docker, no paid services - the database is a local
SQLite file.

And most importently no visibility for each role you can switch between them with no issue 
Ideally each role will have a diffrent interface.

### What you need

| Tool | Version | Check with |
|---|---|---|
| Node.js | 20+ or 22 (LTS) | `node -v` |
| npm | comes with Node.js | `npm -v` |

### Install

From the project root, once:

```bash
npm install
```

This installs both workspaces (`backend`, `frontend`) and generates the
Prisma client the backend is built against.

Then prepare the local database, once:

```bash
npm run db:setup --workspace backend
```

This creates `backend/prisma/hub.db` and seeds it with the example requests
below. The file lives only on your machine and is not committed, so a fresh
clone always needs this step. Run it again any time you want the original
requests back (`npm run db:seed --workspace backend` does the same reset
without touching the table structure).

### Run

```bash
npm run dev
```

Starts both halves at once:

- the **backend** on <http://localhost:3000>
- the **frontend** on <http://localhost:5173>

### Stop

Click into the terminal running it and press **Ctrl + C**. 

### Where things live

```text
backend/src/requests/   the flow: data, rules, actors (auth), service, controller
backend/prisma/         schema, seed data, the SQLite file (not committed)
frontend/src/           the screen (App.tsx) and the API client
e2e/                    the end-to-end test
docs/                   the design documents
images/                 diagrams used by the docs
decisions/              architecture decision records (ADRs)
```

### What you can try

Open <http://localhost:5173>. Five requests are seeded:

| id | department | status |
|---|---|---|
| `REQ-1001` | IT | Submitted |
| `REQ-1002` | IT | In Progress |
| `REQ-1003` | IT | Completed |
| `REQ-1004` | IT | Denied |
| `REQ-1005` | HR | Submitted |

The **Acting as** dropdown switches identity - there is no login, this is a
teaching stand-in (see [docs/architecture.md](docs/architecture.md)). Try:

- As **Dana Karam — Employee**, submit a new request.
- Switch to **Sami Nassar — HR Lead**, click **Assign** on an **IT**
  request → refused (wrong department), status unchanged.
- Switch to **Karim Rahal — IT Lead**, click **Assign** on that same
  request → succeeds.
- Click **Start**, then **Complete**. Click **History** on any request to
  see its full timeline.

### The endpoints

| Method | URL | Header | Body | What it does |
|---|---|---|---|---|
| GET | `/requests` | - | - | list all requests, or filter with `?department=` and/or `?status=` |
| GET | `/requests/:id` | `x-hub-actor` | - | one request + history |
| POST | `/requests` | `x-hub-actor` | `{ title, description, department }` | create a request (starts `SUBMITTED`) |
| POST | `/requests/:id/transition` | `x-hub-actor` | `{ to }` | change a status |

Not-allowed requests return `400` (malformed), `401` (unknown/missing
actor), `403` (known actor, not allowed to do this), `404` (unknown id), or
`409` (illegal transition). Full contract, including which case returns
what and why: [docs/full-stack-delivery.md](docs/full-stack-delivery.md).

### Running the tests

Once per machine, before the first `test:e2e` run - this downloads the
Chromium browser Playwright drives, and never needs repeating after that:

```bash
npx playwright install chromium
```

Then, any time:

```bash
npm test          # 28 backend tests: business rules, authorization, database integration, regression
npm run test:e2e  # one real-browser test, driving the actual app end to end
```

`npm test` needs nothing running - it uses its own copy of the database and
never touches `hub.db`. `npm run test:e2e` starts the backend and frontend
itself if they aren't already running (`npm run dev` in another terminal is
fine too - it reuses it), and reseeds the database first, so re-running
either command as many times as you like always gives the same result.


### Project flow

`npm run dev` starts two processes at once: the NestJS backend (port 3000,
via `nest start --watch`) and the Vite frontend (port 5173).

On backend boot, `main.ts` calls `NestFactory.create(AppModule)`. Nest reads
`app.module.ts`'s `imports: [RequestsModule]`, then `requests.module.ts`'s
`providers`/`controllers`, and constructs one instance each of
`PrismaService`, `RequestsService` (with Prisma injected into it) and
`RequestsController` (with the service injected into it) - all before the
server starts listening.

From there, a real action - say, clicking "Assign" on a request - triggers:

1. `frontend/src/api/requests.ts` sends `POST /requests/:id/transition`,
   with header `x-hub-actor` identifying who is asking.
2. `requests.controller.ts` receives it - no decisions, just reads the id,
   the `to` status and the actor header, and calls `requests.service.ts`.
3. `requests.service.ts` runs five checks, in order, each backed by a
   different file:
   - `actors.ts` - is this a known actor? (401 if not)
   - Prisma - does this request exist? (404 if not)
   - `requests.data.ts` - is `to` a real status? (400 if not)
   - `actors.ts` again - is this actor allowed to make this specific move?
     (403 if not)
   - `requests.rules.ts` - is this move legal from the request's current
     status? (409 if not)
4. Only if every check passes does `requests.service.ts` write the update
   (and a new history row) through `PrismaService` to `hub.db`.
5. The result flows back up through `requests.controller.ts` as the HTTP
   response; the frontend re-fetches the list and the row updates on
   screen.

Full endpoint-by-endpoint contract: [docs/full-stack-delivery.md](docs/full-stack-delivery.md).

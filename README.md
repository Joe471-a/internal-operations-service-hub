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

We include a small **working backend** that implements
one part of that design: the **request lifecycle** - moving a request between its statuses (Submitted, Assigned, In Progress, Completed, Denied) and rejecting changes that are not allowed.

Built with NestJS. In-memory only - no database, no frontend, no authentication.

This code is expected to change as the design evolves.

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

### Run

```bash
npm run dev
```

The backend starts on <http://localhost:3000>.

### Stop

Click into the terminal running it and press **Ctrl + C**.

### Where things live

```text
backend/src/    the request lifecycle code
docs/           the design documents
images/         diagrams used by the docs
decisions/      architecture decision records (ADRs)
```

### What you can try

Four requests are seeded:

| id | status |
|---|---|
| `REQ-1001` | Submitted |
| `REQ-1002` | In Progress |
| `REQ-1003` | Completed |
| `REQ-1004` | Denied |

With `npm run dev` running, open in a browser:

- <http://localhost:3000/requests> — all requests
- <http://localhost:3000/requests/REQ-1001> — one request + its history

With `npm run dev` running, in another terminal:

```powershell
# create a request (starts as Submitted)
Invoke-RestMethod -Method Post http://localhost:3000/requests

# valid change: REQ-1001 Submitted -> Assigned
Invoke-RestMethod -Method Post "http://localhost:3000/requests/REQ-1001/transition" -ContentType application/json -Body '{"to":"Assigned"}'

# rejected change: REQ-1003 is Completed and cannot change -> 409
Invoke-RestMethod -Method Post "http://localhost:3000/requests/REQ-1003/transition" -ContentType application/json -Body '{"to":"Assigned"}'
```

### The endpoints

| Method | URL | What it does |
|---|---|---|
| GET | `/requests` | list all requests |
| GET | `/requests/:id` | one request + history |
| POST | `/requests` | create a request (starts `Submitted`) |
| POST | `/requests/:id/transition` | change a status — body `{ "to": "Assigned" }` |

Not-allowed changes return `400`, `404` or `409`.

### Verify

```bash
npm run verify
```

Builds the app, starts it, runs the lifecycle checks (valid and invalid status
changes), prints `PASS` / `FAIL` for each, then stops. All checks should pass.

More detail on how it was built and tested: [docs/agentic-workflow.md](docs/agentic-workflow.md)



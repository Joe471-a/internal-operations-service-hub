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

This section describes the v0.1 foundation, where the project started. What
is actually built and runnable today (v0.2 through v0.4, plus login) is
described under [Working Implementation](#working-implementation) below.

---

## Working Implementation

**v0.2 - Request Lifecycle** added a small in-memory NestJS backend for the request lifecycle only - no frontend, database, or authentication yet (see [docs/week2-agentic-workflow.md](docs/week2-agentic-workflow.md)).

**v0.3 - Integrated Product Slice.** A full, narrow Service Request flow:
React frontend, NestJS backend, real persistence (Prisma/SQLite), an
authorization rule, and automated tests at every level. Full contract and
test results: [docs/week3-full-stack-delivery.md](docs/week3-full-stack-delivery.md).
How it evolved from the Week 2 in-memory milestone:
[docs/week2-agentic-workflow.md](docs/week2-agentic-workflow.md).

**v0.4 - AI-assisted Request Intake.** A submitted request's free text is
classified by a real language model (Groq, free tier) and checked against
two rules before it is written - the content must match the declared
department, and staff/leads may not file to their own department. The AI
is advisory only and fails open: if it's unavailable, the request still
goes through, just marked unverified. Full design and contract:
[docs/week4-production-ai.md](docs/week4-production-ai.md).

No Docker, no paid services - the database is a local SQLite file. A free
Groq account is needed for the v0.4 AI classification feature (see below).

**Login and role-based access (added after v0.4).** Each person signs in with
their own username and password - there is no sign-up, accounts are created
by the hub administrator - and only sees what their role allows. An employee
sees their own requests; department staff and leads also see their own
department's requests, with tabs and actions to match. Design and test
accounts: [docs/extra.md](docs/extra.md).

### What you need

| Tool | Version | Check with |
|---|---|---|
| Node.js | 20+ or 22 (LTS) | `node -v` |
| npm | comes with Node.js | `npm -v` |

You'll also need a free Groq account for the v0.4 AI feature - see Install below.

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
and the six user accounts listed below. The file lives only on your machine and is not committed, so a fresh
clone always needs this step. Run it again any time you want the original
requests back (`npm run db:seed --workspace backend` does the same reset
without touching the table structure).

Then create your `.env` file (holds the Groq key and the login secret), once:

```bash
cp backend/.env.example backend/.env
```

This copies the empty template to a real `backend/.env` file you'll fill
in next (two values: `GROQ_API_KEY` and `AUTH_JWT_SECRET`) - skip this if `backend/.env` already exists, since it would
overwrite it and erase your key.

Get a free key at <https://console.groq.com/keys> and set it as
`GROQ_API_KEY` in `backend/.env`. This is required - without it, the AI
check fails open on every request (see
[docs/week4-production-ai.md](docs/week4-production-ai.md)), which still works, but
never actually classifies anything.

Also set `AUTH_JWT_SECRET` in the same file. It signs login session tokens
and is required - the backend refuses to start without it. Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the output after `AUTH_JWT_SECRET=` in `backend/.env`.

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
backend/src/requests/          the flow: data, rules, roles (actors.ts), service, controller
backend/src/auth/              login, session tokens, and the guard every /requests route sits behind
backend/src/users/             the user accounts (username, hashed password, role, department)
backend/src/ai-classification/ the Groq classifier boundary and the two AI rules (v0.4)
backend/prisma/                schema, seed data, the SQLite file (not committed)
frontend/src/                  the screens (App.tsx, components/) and the API client
e2e/                           the end-to-end test
evals/                         AI evaluation cases against the real Groq API (v0.4)
docs/                          the design documents
images/                        diagrams used by the docs
decisions/                     architecture decision records (ADRs)
```

### What you can try

Open <http://localhost:5173>. Five requests are seeded, all showing
**Not checked** in the "AI Check" column - they predate v0.4 and were never
actually run through the classifier, unlike anything you submit yourself:

| id | department | status |
|---|---|---|
| `REQ-1001` | IT | Submitted |
| `REQ-1002` | IT | In Progress |
| `REQ-1003` | IT | Completed |
| `REQ-1004` | IT | Denied |
| `REQ-1005` | HR | Submitted |

All five were submitted by Dana, so what you see depends on who you sign in
as: Dana sees all five (they're hers), IT staff and leads see the four IT
ones, the HR lead sees only `REQ-1005`, and Finance sees none. Sign in with one of the
accounts below (there is no sign-up - accounts are created by the hub
administrator; see [docs/extra.md](docs/extra.md)). Use **Log out** in the
top bar to switch between them:

| Username | Password | Person |
|---|---|---|
| `dana` | `dana123` | Dana Karam - Employee |
| `yara` | `yara123` | Yara Fakhoury - IT Staff |
| `karim` | `karim123` | Karim Rahal - IT Lead |
| `sami` | `sami123` | Sami Nassar - HR Lead |
| `tarek` | `tarek123` | Tarek Sleiman - Finance Staff |
| `layla` | `layla123` | Layla Haddad - Finance Lead |

Try:

- Log in as **dana**, submit a new request. She only ever sees her own.
- Log out, log in as **sami** - only the HR request (`REQ-1005`) is there;
  IT requests never appear for a different department.
- Log out, log in as **karim** (IT Lead), click **Assign** on an **IT**
  request → succeeds.
- Click **Start**, then **Complete**. Click **History** on any request to
  see its full timeline, including whether it was AI-checked.
- Back as **dana**, submit an IT-sounding problem under **HR**
  → refused (400), names the department it actually looks like.
- Submit that same problem correctly, under **IT** → succeeds, "AI Check"
  now shows **AI-checked**.
- Log in as **yara** (IT Staff), submit an IT-sounding request to
  **IT** → refused (403) - staff/leads don't file to their own department.
- Submit a request with `idk` as both the title and description → refused
  (400), asks for more detail instead of guessing a department.
- Try the mismatch the other way round: an HR-sounding problem (e.g. a
  leave-policy question) submitted under **IT** → also refused (400) -
  Rule A works in both directions, not just IT.
- Log in as **tarek** (Finance Staff) and submit an IT-sounding
  problem (e.g. a VPN issue) correctly, under **IT** → succeeds, even
  though a staff member submitted it. Rule B only blocks filing to your
  *own* department - a Finance Staff member filing an IT-matching request
  to IT is unaffected, since IT isn't their department.
- Go deeper: stop `npm run dev`, blank `GROQ_API_KEY` in `backend/.env`,
  restart, then submit anything → still succeeds, but "AI Check" shows
  **Not checked** instead of blocking you - the AI being down never stops
  real work (put the key back and restart again afterward).

### The endpoints

Every `/requests` endpoint needs a session token - sign in first, then send
it as `Authorization: Bearer <token>`. The screen does this for you.

| Method | URL | Auth | Body | What it does |
|---|---|---|---|---|
| POST | `/auth/login` | - | `{ username, password }` | sign in; returns a session token and who you are |
| POST | `/auth/change-password` | Bearer | `{ currentPassword, newPassword }` | change your own password |
| GET | `/requests` | Bearer | - | every request you may see; narrow with `?view=mine\|handle\|assign\|all` |
| GET | `/requests/:id` | Bearer | - | one request + history |
| POST | `/requests` | Bearer | `{ title, description, department }` | create a request (starts `SUBMITTED`) |
| POST | `/requests/:id/transition` | Bearer | `{ to }` | change a status |

Not-allowed requests return `400` (malformed), `401` (wrong username or
password, or a missing/expired session), `403` (signed in, but not allowed
to do this), `404` (unknown id), or `409` (illegal transition). Full
contract, including which case returns what and why:
[docs/week3-full-stack-delivery.md](docs/week3-full-stack-delivery.md) (the
v0.3 contract - it predates login and identified callers with an
`x-hub-actor` header, which is now replaced by the token above; see
[docs/extra.md](docs/extra.md)).

Since v0.4, `POST /requests` can also return `400` or `403` for AI-driven
reasons (content doesn't match the declared department, or staff/leads
filing to their own department) - see
[docs/week4-production-ai.md](docs/week4-production-ai.md).

### Running the tests

Once per machine, before the first `test:e2e` run - this downloads the
Chromium browser Playwright drives, and never needs repeating after that:

```bash
npx playwright install chromium
```

Then, any time:

```bash
npm test                     # 76 backend tests: business rules, authorization, database integration, regression, AI rules
npm run test:e2e             # one real-browser test, driving the actual app end to end
npm run eval:classification  # 17 cases against the real Groq API - needs GROQ_API_KEY, not part of npm test
npm run test:all             # npm test, then test:e2e, then eval:classification, in one command
```

`npm test` needs nothing running - it uses its own copy of the database and
never touches `hub.db`. `npm run test:e2e` starts the backend and frontend
itself if they aren't already running (`npm run dev` in another terminal is
fine too - it reuses it), and reseeds the database first, so re-running
either command as many times as you like always gives the same result.
`npm run eval:classification` makes real calls to Groq and is not a
pass/fail gate - it checks whether the real model still behaves the way the
product expects, since a model (unlike our own code) can drift over time.


### Project flow

`npm run dev` starts two processes at once: the NestJS backend (port 3000)
and the Vite frontend (port 5173). Every action below is the same basic
shape: the screen sends one HTTP request (with your session token),
`AuthGuard` works out who you are, `requests.controller.ts` just
forwards it with no decisions of its own, `requests.service.ts` runs a
short list of checks in order, and only if every check passes does
anything actually get written to `hub.db`. The two flows below are that
same shape, for the two things you can do.

**1. Submitting a request** (clicking **Submit Request**):

1. The screen sends `POST /requests` - title, description, department, and
   the session token saying who's asking.
2. Is the session valid, and is the person even allowed to submit? (401 /
   403 if not)
3. Is the title/description non-empty, and the department real? (400 if
   not)
4. Now the new part: the title and description are sent to Groq, asking
   "which department does this sound like?" Two things get checked against
   that answer:
   - Does it match the department that was picked? (400 if not)
   - Is the actor staff/lead of that same department? (403 if so - they
     should resolve it themselves, not file it)
   - If Groq can't be reached at all, both of those checks are skipped and
     the request goes through anyway, just marked unverified - the AI
     being down never blocks real work.
5. Only now does the request actually get written, including whether the
   AI verified it. The screen refreshes and the new row appears.

**2. Moving a request** (clicking **Assign**, **Start**, **Complete**, or
**Deny**):

1. The screen sends `POST /requests/:id/transition` with the target status
   and the session token.
2. Is the session valid? (401 if not) Does the request even exist? (404 if
   not)
3. Is the target a real status? (400 if not)
4. Is this actor allowed to make this specific move? (403 if not)
5. Is this move legal from the request's current status - e.g. not
   skipping a step, not touching an already-finished request? (409 if not)
6. Only now does the update get written, with a new history row. The
   screen refreshes and the status updates.

Full contract: [docs/week3-full-stack-delivery.md](docs/week3-full-stack-delivery.md)
for flow 2 and the endpoints above, [docs/week4-production-ai.md](docs/week4-production-ai.md)
for the AI step inside flow 1.

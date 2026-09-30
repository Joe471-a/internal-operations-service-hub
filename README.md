# Internal Operations Service Hub

[![Release gate](https://github.com/Joe471-a/internal-operations-service-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/Joe471-a/internal-operations-service-hub/actions/workflows/ci.yml)
[![AI evals](https://github.com/Joe471-a/internal-operations-service-hub/actions/workflows/evals.yml/badge.svg)](https://github.com/Joe471-a/internal-operations-service-hub/actions/workflows/evals.yml)

A company-internal system for requesting and tracking help from departments such as
IT, HR and Finance: employees submit requests in one place and follow their status;
department staff and leads handle the requests of their own department.

**Current version: v1.0** - deployed, monitored and released through an automated gate.

| | |
|---|---|
| **Live app** | <https://hub-frontend-xtup.onrender.com> |
| **Backend health** | <https://hub-backend-5u3t.onrender.com/health> |
| **Stack** | React + Vite · NestJS · PostgreSQL (Prisma) · Groq AI · Render · GitHub Actions |

**Contents:** [Live app](#live-app) · [Engineer quick start](#engineer-quick-start) ·
[Operations](#operations) · [Evidence map](#evidence-map) · [Reference](#reference)

---

## Live app

### What the product does

- **Employees** submit a request to a department and follow its status: *Submitted →
  Assigned → In Progress → Completed*, or *Denied*.
- **An AI check** reads each new request and refuses one filed to the wrong department
  (an IT problem sent to HR), or filed by staff to their own department. The AI only
  advises: if it is unavailable, the request is still accepted and marked *Not checked*.
- **Department leads** assign or deny incoming requests; **staff and leads** move them
  forward. Each person only ever sees what their role allows - employees their own
  requests, staff and leads also their own department's.
- Every request keeps a full history of who changed what, and when.

### Demo access

There is no sign-up - accounts are created by the hub administrator. These six demo
accounts are public on purpose, with fake data:

| Username | Password | Person | Role |
|---|---|---|---|
| `dana` | `dana123` | Dana Karam | Employee |
| `yara` | `yara123` | Yara Fakhoury | IT Staff |
| `karim` | `karim123` | Karim Rahal | IT Lead |
| `sami` | `sami123` | Sami Nassar | HR Lead |
| `tarek` | `tarek123` | Tarek Sleiman | Finance Staff |
| `layla` | `layla123` | Layla Haddad | Finance Lead |

Use **Log out** in the top bar to switch accounts. Five requests are seeded
(`REQ-1001` to `REQ-1005`, all Dana's); new ones continue from `REQ-1006`.

### One critical journey to try

1. Sign in as **dana** → **New Request** → an IT problem (e.g. *"My laptop does not
   turn on at all"*) under **IT** → submitted, marked **AI-checked**.
2. Log out, sign in as **sami** (HR Lead) → the IT request is not visible at all.
3. Log out, sign in as **karim** (IT Lead) → **Assign** it → **Start** → **Complete**.
   Open **History** to see every step and who made it.
4. Back as **dana** → the request shows **Completed**.

> The first sign-in after a long quiet period can take up to a minute while the free
> backend wakes up; after that it is instant.

### More to try

- As **dana**, submit an IT-sounding problem under **HR** → refused (`400`), naming the
  department it actually looks like. The other way round (a leave-policy question
  under **IT**) is refused too.
- Submit `idk` as both title and description → refused (`400`), asking for more
  detail instead of guessing a department.
- As **yara** (IT Staff), submit an IT problem to **IT** → refused (`403`): staff and
  leads resolve their own department's problems rather than file them.
- As **tarek** (Finance Staff), submit an IT problem to **IT** → accepted: the rule
  only blocks filing to *your own* department.
- As **karim**, finished requests (Completed, Denied) sit in their own **Closed**
  section below the open queue; clicking a status card shows a single list of that
  status.

---

## Engineer quick start

### Prerequisites

| Tool | Version | Check with |
|---|---|---|
| Node.js | 22 (LTS) - same as CI and Render | `node -v` |
| npm | comes with Node.js | `npm -v` |
| Docker Desktop | any recent version - runs the local PostgreSQL | `docker --version` |
| A Groq account | free - for the AI check | <https://console.groq.com/keys> |

### 1. Install

From the project root:

```bash
npm install
```

This installs both workspaces (`backend`, `frontend`) and generates the Prisma client.

### 2. Configure

```bash
cp backend/.env.example backend/.env
```

Skip this if `backend/.env` already exists - it would overwrite your values. Then, in
`backend/.env`:

| Variable | What to put |
|---|---|
| `DATABASE_URL` | already set to the local database from `docker-compose.yml` - leave it |
| `GROQ_API_KEY` | your free key from <https://console.groq.com/keys>. Without it the app still works, but every request is saved *Not checked* |
| `AUTH_JWT_SECRET` | any long random value - the backend refuses to start without it. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

`backend/.env` is ignored by Git - never commit a real key. The frontend needs no
configuration locally (it defaults to the backend on `localhost:3000`).

### 3. Database

```bash
docker compose up -d                    # PostgreSQL 16, reachable only from this machine
npm run db:setup --workspace backend    # creates the tables and seeds the demo data
```

`db:setup` creates the six demo accounts and the five example requests. Run
`npm run db:seed --workspace backend` any time to put the demo data back (it resets
the requests and passwords, not the table structure). `docker compose down` stops the
database; your data stays in a Docker volume.

### 4. Run

```bash
npm run dev
```

Starts the **backend** on <http://localhost:3000> and the **frontend** on
<http://localhost:5173>. Stop with **Ctrl + C**.

### 5. Test

Once per machine, before the first end-to-end run:

```bash
npx playwright install chromium
```

Then, any time (Docker must be running):

```bash
npm test                     # 120 tests: business rules, authorization, database integration, races, regression, AI rules, health, logging
npm run test:e2e             # a real browser drives the actual app end to end
npm run eval:classification  # 17 cases against the real Groq model - needs GROQ_API_KEY
npm run test:all             # all three, in order
```

- `npm test` uses its own database (`hub_test`) and never touches your data.
- `npm run test:e2e` starts the app itself if it is not already running, and reseeds
  the local database first, so it gives the same result every run.
- The evals call the real model, so they check that it still behaves the way the
  product expects - a model can drift even when the code has not changed.

### 6. The release gate

Every push to `main` runs [`ci.yml`](.github/workflows/ci.yml) on a fresh machine:
typecheck, build, the 120 tests and the end-to-end test, against its own PostgreSQL.
Render deploys only after it passes, so a red run never reaches the live app.
[`evals.yml`](.github/workflows/evals.yml) runs the AI evals on every push, every
night and on demand - they warn but never block a release, because the hub works
without the AI. Details: [week5-release-operations.md](docs/week5-release-operations.md).

---

## Operations

### Health

```bash
npm run health -- https://hub-backend-5u3t.onrender.com
```

`GET /health` reports whether the running instance can work:

| `status` | HTTP | Meaning |
|---|---|---|
| `ok` | 200 | database and AI both reachable |
| `degraded` | 200 | the hub works, but the AI check is off - requests are saved *Not checked* |
| `error` | 503 | the database is unreachable - nothing can be read or saved |

It also reports `release` - the exact commit running.

### Logs, monitoring and alerting

- **Logs:** Render → `hub-backend` → **Logs**. One JSON line per request (method,
  path, status, time taken, who), crashes with their stack trace, and `ai_fail_open`
  warnings - never passwords, tokens or request text.
- **Live watch:** `npm run monitor -- https://hub-backend-5u3t.onrender.com` checks
  `/health` every second, prints `ALERT` after 3 bad answers in a row and `RECOVERED`
  when healthy again.
- **24/7 alerts:** UptimeRobot checks `/health` every 5 minutes and emails when it is
  not `ok`; Render emails on failed deploys; GitHub emails when the gate or the nightly
  evals fail.

`health`, `monitor` and `smoke` need only Node - no install, no database, no `.env`
(`node scripts/<name>.js <url>` works on a fresh clone).

### Controlled failure and recovery

Three failures were caused on purpose on the live app and recovered - an AI outage, a
broken release, and the backend taken down - with timelines and outputs in
[week5-failure-drills.md](docs/week5-failure-drills.md). What to do when something breaks:

| Symptom | Recovery |
|---|---|
| `/health` is `degraded` | check `GROQ_API_KEY` on Render; the hub keeps working meanwhile |
| a deploy failed | fix the setting or the code - the previous version keeps serving until then |
| a bad release is live | Render → Deploys → **Rollback** to the last good deploy |
| the backend is down | check Render → Events and Logs; **Resume** or redeploy |
| demo data or a demo password was changed | reseed from a laptop with the database's *External* URL (below) |

```powershell
$env:DATABASE_URL = "<External Database URL from Render>"
npm run db:seed --workspace backend
Remove-Item Env:DATABASE_URL
```

### Post-recovery verification: the smoke test

```bash
npm run smoke -- https://hub-backend-5u3t.onrender.com
```

Runs the critical path against the deployed app - health, a refused wrong password,
sign-in, submit, a refused and an allowed assign, and the change read back - and ends
in **GO** or **NO-GO**. Run it after every release and every recovery: health alone
cannot tell that the app is connected to the wrong database, but signing in can.

---

## Evidence map

| Week | Topic | Evidence |
|---|---|---|
| 1 | Design | [product-spec.md](docs/product-spec.md) · [architecture.md](docs/architecture.md) · [data-model.md](docs/data-model.md) · decisions [ADR-001](docs/decisions/ADR-001.md) · [ADR-002](docs/decisions/ADR-002.md) · [ADR-003](docs/decisions/ADR-003.md) |
| 2 | Engineering ownership | [week2-agentic-workflow.md](docs/week2-agentic-workflow.md) · lifecycle rules in [`requests.rules.ts`](backend/src/requests/requests.rules.ts) and their tests |
| 3 | Full stack | [week3-full-stack-delivery.md](docs/week3-full-stack-delivery.md) · [`e2e/`](e2e) · the integration and regression tests in [`backend/src/requests/`](backend/src/requests) |
| 4 | Production AI | [week4-production-ai.md](docs/week4-production-ai.md) · [`ai-classification/`](backend/src/ai-classification) · [`evals/`](evals) |
| 5 | Release ownership | [week5-release-operations.md](docs/week5-release-operations.md) · [week5-failure-drills.md](docs/week5-failure-drills.md) · [ADR-004](docs/decisions/ADR-004.md) · [`.github/workflows/`](.github/workflows) · [`scripts/`](scripts) |
| - | Changes between milestones | [extra.md](docs/extra.md) - login, visibility, dashboard, and the Week 5 product changes |

---

## Reference

### The endpoints

Every `/requests` endpoint needs a session token - sign in first, then send it as
`Authorization: Bearer <token>`. The screen does this for you.

| Method | URL | Auth | Body | What it does |
|---|---|---|---|---|
| GET | `/health` | - | - | whether this instance can work - see [Operations](#health) |
| POST | `/auth/login` | - | `{ username, password }` | sign in; returns a session token and who you are |
| POST | `/auth/change-password` | Bearer | `{ currentPassword, newPassword }` | change your own password |
| GET | `/requests` | Bearer | - | every request you may see; narrow with `?view=mine\|handle\|assign\|all` |
| GET | `/requests/:id` | Bearer | - | one request + history (`:id` is the number, e.g. `1006`) |
| POST | `/requests` | Bearer | `{ title, description, department }` | create a request (starts `SUBMITTED`) |
| POST | `/requests/:id/transition` | Bearer | `{ to }` | change a status |

Not-allowed requests return:

- `400` - malformed: an empty or too long title (max 120) or description (max 2,000),
  an unknown department or status, an invalid id, or AI-driven: the content does not
  match the declared department, or it is too unclear to route
- `401` - wrong username or password, or a missing or expired session
- `403` - signed in but not allowed: the wrong role or department, or staff filing to
  their own department (AI-driven)
- `404` - unknown request
- `409` - an illegal transition (a skipped step, a finished request), or the request
  was just changed by someone else

Full contract: [week3-full-stack-delivery.md](docs/week3-full-stack-delivery.md) (it
predates login - callers are now identified by the token above, see
[extra.md](docs/extra.md)) and [week4-production-ai.md](docs/week4-production-ai.md)
for the AI-driven answers.

### How a request flows

Every action has the same shape: the screen sends one HTTP request with the session
token, `AuthGuard` works out who you are, `requests.controller.ts` only forwards it,
`requests.service.ts` runs a short list of checks in order, and only if every check
passes is anything written to the database.

**1. Submitting a request** (**Submit Request**):

1. The screen sends `POST /requests` - title, description, department, and the
   session token.
2. Is the session valid, and may this person submit? (`401` / `403` if not)
3. Are the title and description non-empty and within the length limits, and the
   department real? (`400` if not)
4. The title and description are sent to Groq: "which department does this sound
   like?"
   - Does it match the chosen department? (`400` if not)
   - Is the person staff or lead of that same department? (`403` if so - they should
     resolve it themselves)
   - If Groq cannot be reached, both checks are skipped and the request is saved
     anyway, marked *Not checked* - the AI being down never blocks real work.
5. The request is written, with the next number from the database (`REQ-1006`,
   `REQ-1007`, ...) and whether the AI checked it. The list refreshes.

**2. Moving a request** (**Assign**, **Start**, **Complete** or **Deny**):

1. The screen sends `POST /requests/:id/transition` with the target status and the
   session token.
2. Is the session valid? (`401`) Does the request exist? (`404`)
3. Is the target a real status? (`400`)
4. May this person make this move, in this department? (`403`)
5. Is the move legal from the current status - no skipped step, no finished request?
   (`409`)
6. The change and its history row are saved together - but only if the request is
   still in the status that was checked. If someone else changed it a moment earlier,
   nothing is written and the answer is `409`, asking to refresh.

### Project structure

```text
backend/src/requests/           the request flow: data, lifecycle rules, roles (actors.ts), service, controller
backend/src/auth/               login, session tokens, and the guard every /requests route sits behind
backend/src/users/              the user accounts (username, hashed password, role, department)
backend/src/ai-classification/  the Groq boundary and the two AI rules
backend/src/health/             GET /health
backend/src/logging/            the JSON log lines
backend/prisma/                 schema and seed data
frontend/src/                   the screens (App.tsx, components/) and the API client
e2e/                            the end-to-end test
evals/                          AI evaluation cases against the real Groq model
scripts/                        health, monitor and smoke - operator tools
.github/workflows/              the release gate (ci.yml) and the AI evals (evals.yml)
docs/                           the design and milestone documents
docs/decisions/                 architecture decision records (ADRs)
images/                         diagrams used by the docs
docker-compose.yml              the local PostgreSQL
```

### Version history

| Version | Milestone | What it added |
|---|---|---|
| v0.1 | Week 1 - Design | requirements, architecture, data model, decisions |
| v0.2 | Week 2 - Engineering ownership | the request lifecycle, in memory |
| v0.3 | Week 3 - Full stack | React + NestJS + database, authorization, integration and end-to-end tests |
| v0.4 | Week 4 - Production AI | AI-assisted intake with fail-open, AI evals; then real login and role-based visibility |
| v1.0 | Week 5 - Release ownership | PostgreSQL on Render, release gate, health, logs, monitoring and alerting, failure drills, smoke test, sequential ids |

### Deploy your own copy

The live app runs as three Render services (free plan) built from this repository:

| Service | Render type | Build / start | Settings |
|---|---|---|---|
| database | PostgreSQL 16 | - | - |
| backend | Web Service | build `npm ci && npm run build --workspace backend` · start `cd backend && npx prisma db push --skip-generate && node dist/main.js` · health check path `/health` | `DATABASE_URL` (the database's *Internal* URL), `AUTH_JWT_SECRET` (a new random value), `GROQ_API_KEY`, `CORS_ORIGIN` (the frontend's URL), `NODE_VERSION=22` |
| frontend | Static Site | build `npm ci && npm run build --workspace frontend` · publish `frontend/dist` | `VITE_API_URL` (the backend's URL), `NODE_VERSION=22` |

After the first deploy, seed the database once from a laptop with its *External* URL
(see [Operations](#controlled-failure-and-recovery)), and set auto-deploy to **After CI
Checks Pass** so only green commits go live. Why it is built this way - two services,
PostgreSQL, the configuration and secrets:
[week5-release-operations.md](docs/week5-release-operations.md) and
[ADR-004](docs/decisions/ADR-004.md).

### Known limitations

The accepted risks of this release - the free backend sleeping after a quiet period,
the public demo accounts, the details `/health` exposes, the schema being synced at
startup, and no login rate limiting - each with its impact and why it is accepted, are
listed in [week5-release-operations.md](docs/week5-release-operations.md), section 7.

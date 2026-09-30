# Week 5 - Release Operations (v1.0)

The hub runs on a remote target that does not depend on anyone's laptop, every
release passes an automated gate before it goes live, and the live app can be
checked, watched, broken on purpose and recovered by someone other than its author.
This document describes that release; the failure drills that prove it are in
[week5-failure-drills.md](week5-failure-drills.md).

| | |
|---|---|
| Live app | <https://hub-frontend-xtup.onrender.com> |
| Backend | <https://hub-backend-5u3t.onrender.com> · health at `/health` |
| Released as | tag `v1.0` (the exact commit is also reported live by `/health` as `release`) |

## 1. Remote target

Three services on **Render** (free plan, Frankfurt region), deployed from the `main`
branch of this repository:

| Service | Render type | What it runs | Build / start |
|---|---|---|---|
| `hub-frontend` | Static Site | the React app, built once into static files | `npm ci && npm run build --workspace frontend` → publishes `frontend/dist` |
| `hub-backend` | Web Service | the NestJS API | build `npm ci && npm run build --workspace backend` · start `cd backend && npx prisma db push --skip-generate && node dist/main.js` |
| `hub-db` | PostgreSQL 16 | the database | managed by Render |

**Why two services and not one:** the frontend is plain files, so a static site
serves it instantly and never sleeps - the login page appears at once even while the
backend is waking up. The two deploy independently, and when the backend is down users
still get the app and an error rather than a dead address (drill 3) - though nothing
works without the API, since the frontend holds no data of its own. It mirrors the
App/Web and Backend split in [architecture.md](architecture.md). One service would
also have worked (no CORS or API-URL settings); two were chosen for the instant page
and independent deploys.

**Why PostgreSQL and not SQLite:** Render's free web services lose their disk on
every restart and redeploy, so a SQLite file would lose all data on the live app.
PostgreSQL runs as its own service and keeps it. See
[ADR-004](decisions/ADR-004.md).

**Schema changes** ship with the code: the start command runs `prisma db push`,
which applies only the differences between `schema.prisma` and the database and
refuses changes that would delete data. This is kept on purpose while the schema may
still change - see the drills document (drill 2b) for its one risk and how the smoke
test covers it.

## 2. Configuration and secrets

The same code runs locally, in CI and on Render; only the configuration changes.

| Variable | Where it is set | Secret? | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Render (hub-backend) · `backend/.env` locally | **yes** on Render | the database to use |
| `AUTH_JWT_SECRET` | Render · `backend/.env` locally | **yes** | signs login sessions - a different value in each environment |
| `GROQ_API_KEY` | Render · `backend/.env` locally · GitHub Actions secret (evals only) | **yes** | the AI classification |
| `CORS_ORIGIN` | Render (hub-backend) | no | the only website allowed to call the API from a browser |
| `NODE_VERSION` | Render (both) | no | `22`, same as local and CI |
| `VITE_API_URL` | Render (hub-frontend), at build time | no - it is written into the public JavaScript | where the frontend finds the API |

- Only `backend/.env.example` and `frontend/.env.example` are committed, with empty
  or local-only values; `.env` is in `.gitignore`, and no real secret appears in the
  Git history.
- The values in the CI workflow (`hub/hub`, `ci-only-secret...`) exist only inside
  the throwaway CI machine.
- Each environment has its own secrets: the `AUTH_JWT_SECRET` on Render is not the
  one used locally, so exposing one never affects the other, and a secret can be
  rotated on Render at any time without touching the code.

## 3. Release gate

Every push to `main` (and every pull request) runs
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) on a fresh GitHub machine
with its own PostgreSQL 16:

1. `npm ci` - the exact dependency versions
2. typecheck backend and frontend
3. build backend and frontend
4. `npm test` - 120 unit, integration and regression tests
5. database setup, then the end-to-end test in a real browser

Render's auto-deploy is set to **"After CI Checks Pass"** on both services, so a
red run never reaches the live app.

**Proven both ways:**

- **Green:** every push since the gate was added passed in about 1.5-2 minutes, and
  Render deployed only after it.
- **Red:** a throwaway branch removed the rule that a lead may only act on their own
  department's requests. The gate failed at the tests step (2 tests caught it), the
  end-to-end test was skipped, a failure email arrived, and nothing was deployed.
  The branch was then deleted without merging, leaving `main` untouched
  (pull request #1, run `36600102394`).

**Not in the gate, on purpose:** the AI evals
([`.github/workflows/evals.yml`](../.github/workflows/evals.yml)). They call the real
Groq model, whose answers can vary, and the hub works without the AI (fail-open), so
the AI must never be the reason a release is blocked. They run on every push
(warning only - they never block a deploy), every night at 03:00 UTC and on demand,
and they go red and email on the nightly and on-demand runs. 17/17 pass.

## 4. Health, logs, monitoring and alerting

| Signal | What it answers | Where |
|---|---|---|
| **`GET /health`** | can this instance work right now? `ok` · `degraded` (AI down, still works - 200) · `error` (database down - 503). Also reports `release` (the running commit) and uptime | public; Render calls it on every deploy and while running |
| **Logs** | what happened and why - one JSON line per request (method, path, status, time, who), crashes with their stack trace, AI fail-open warnings; never passwords, tokens or request text | Render → hub-backend → Logs |
| **`npm run monitor -- <url>`** | watches `/health` every second: `ALERT` after 3 bad answers in a row, `RECOVERED` when healthy again | any machine with Node |
| **UptimeRobot** | checks `/health` every 5 minutes, 24/7, and emails when the answer does not contain `"status":"ok"` - database down, server down, or AI down | uptimerobot.com |
| **Render notifications** | email on failed deploys and service failures | Render account settings |
| **GitHub notifications** | email when the gate or the nightly evals fail | GitHub account settings |

`degraded` is still `200` on purpose: Render must never restart a working hub
because an optional feature is down.

## 5. Failure and recovery

Three failures were caused on purpose on the live app and recovered, each followed
by the critical path working again:

| Drill | Detected | User impact |
|---|---|---|
| AI key broken | monitor `ALERT: DEGRADED`, `ai_fail_open` in the logs | none - requests saved *Not checked* |
| Wrong database password in a release | Render: deploy failed (`P1000`) | none - the previous version kept serving |
| Backend suspended | monitor `ALERT: ERROR` in 3 s | ~3 min without the API; the page stayed up |

Full timelines, outputs and how to reproduce: [week5-failure-drills.md](week5-failure-drills.md).

**Recovery actions available:**

- **Bad configuration:** fix the variable on Render → *Save and deploy*.
- **Bad code:** Render → Deploys → **Rollback** to the last good deploy, then fix
  and push (the gate runs again).
- **Service stopped:** *Resume* it.
- **Demo data changed or a demo password changed:** reseed the live database from a
  laptop, with the database's *External* URL:

  ```powershell
  $env:DATABASE_URL = "<External Database URL>"
  npm run db:seed --workspace backend
  Remove-Item Env:DATABASE_URL
  ```

## 6. Final smoke test and GO / NO-GO

[`scripts/smoke.js`](../scripts/smoke.js) runs the critical path against a deployed
backend and ends in **GO** (exit 0) or **NO-GO** (exit 1):

```bash
npm run smoke -- https://hub-backend-5u3t.onrender.com
```

1. `/health` is `ok` (or `degraded`, flagged)
2. a wrong password is refused - `401`
3. dana signs in
4. dana submits an IT request
5. the HR lead cannot assign it - `403`
6. the IT lead assigns it
7. dana reads it back as assigned - the change was saved

It is the check that catches what health cannot: in drill 2b the app ran against an
empty database while `/health` said `ok`, and only signing in revealed it.

**Release decision for v1.0:** <!-- filled in at release time: date, commit, smoke output, GO -->

## 7. Remaining risks

| Risk | Impact | Why accepted / mitigation |
|---|---|---|
| **Free-tier backend sleeps** after ~15 min without traffic | the first request after that takes 30-50 s | UptimeRobot's check every 5 minutes keeps it awake, so it only sleeps if that monitor is stopped; the frontend never sleeps; a paid instance removes the risk entirely |
| **Demo accounts are public** | anyone can sign in as a demo user and change that account's password | intentional - graders need them, and the data is fake; a reseed restores every password. Real accounts would never be published |
| **`/health` is public and detailed** (release, dependency status, uptime) | reveals which commit runs and when a dependency is down - no secrets | kept for operations and grading (identifying the exact release); in production only `ok`/`error` would be public and the details behind authentication |
| **Schema synced at startup** (`prisma db push`) | a wrong database name can start the app on an empty database | kept while the schema may still change; caught by the smoke test; would become a deliberate release step once stable |
| **No login rate limiting** | passwords can be guessed repeatedly | acceptable for a demo; a production deployment would add rate limiting |
| **Free Render PostgreSQL** | free databases can expire | fine for the grading period; production would use a paid plan with backups |

# Week 5 - Failure and Recovery Drills

Three failures caused **on purpose on the live app** (Render), on 29 September 2026,
to prove that each one is **detected**, **explained**, **fixed** and followed by a
**working critical path**. All times are Beirut time (UTC+3); Render's own log
timestamps are UTC.

Live app: <https://hub-frontend-xtup.onrender.com> · backend health <https://hub-backend-5u3t.onrender.com/health>
· release under test: `9febf26`

## The tools used

| Tool | What it answers | Where |
|---|---|---|
| `GET /health` | is this instance able to work right now? `ok` / `degraded` (AI down, still works) / `error` (database down, 503) | `backend/src/health/` |
| `npm run monitor -- <url>` | asks `/health` every second; `ALERT` after 3 bad answers in a row, `RECOVERED` when healthy again | `scripts/monitor.js` |
| Render **Logs** | why - one JSON line per request, crash and AI fail-open | `backend/src/logging/` |
| Render **Events** | which deploys started, went live or failed, and why | Render dashboard |
| Critical path | the real proof: dana logs in → submits → karim (IT lead) assigns → dana sees it assigned | run against the live API |

The monitor ran against the live backend for the whole session: **3,171 checks from
20:57:45 to 22:01:13**, 2 alerts, 2 recoveries - one pair per real outage.

---

## Drill 1 - AI outage (non-critical dependency)

**Goal:** prove the hub keeps working when Groq is down (fail-open), and that the
outage is visible.

**Break (~20:59):** `GROQ_API_KEY` on hub-backend set to an invalid value → *Save and deploy*.

**Detected (21:00:03)** - the new instance reported the AI down; the monitor alerted
after 3 answers:

```
[9:00:01 PM] 200 degraded database=up ai=down
[9:00:02 PM] 200 degraded database=up ai=down
[9:00:03 PM] 200 degraded database=up ai=down
[9:00:03 PM] ALERT - 3 bad checks in a row: DEGRADED
```

`/health`: `{"status":"degraded","database":"up","ai":"down","release":"9febf26",...}`

Render log - the cause:

```
{"time":"2026-09-29T18:01:08.590Z","level":"warn","event":"ai_fail_open","reason":"the classification model answered with status 401"}
```

**Users kept working (21:01:32):** dana submitted REQ-1011 during the outage - created
in 0.3 s, saved as *Not checked* (`aiVerified: false`).

**Recover (~21:03):** the real key restored → *Save and deploy*.

**Recovered (21:04:48):**

```
[9:04:44 PM] 200 degraded database=up ai=down
[9:04:46 PM] 502 error    database=? ai=?
[9:04:48 PM] 200 ok       database=up ai=up
[9:04:48 PM] RECOVERED - healthy again after 247 bad checks
```

**Critical path after recovery (21:05:19):** dana logged in → submitted REQ-1012
(**AI-checked** again) → karim assigned it → dana saw it *Assigned*.

**User impact:** none - the hub worked throughout, only without the AI check for ~5 minutes.

<!-- screenshot (optional): Render Logs filtered on ai_fail_open -->

---

## Drill 2 - Bad release (wrong database credentials)

**Goal:** prove a broken configuration never reaches users - Render only switches to a
new version once it starts healthy.

**Break (21:37):** the password inside `DATABASE_URL` changed → *Save and deploy*.

**The new deploy failed** - Render Events, 9:37 PM:

```
Deploy failed for 9febf26: ... Exited with status 1 while running your code.
```

Its deploy log - the cause, at startup (`prisma db push` in the start command):

```
Error: P1000: Authentication failed against database server, the provided database credentials for `hub` are not valid
```

**The good version kept serving** - its uptime kept growing (it was never replaced),
dana could log in on every check, and the monitor saw nothing:

```
21:37:55  ok  uptime=227s  dana login: OK
21:38:57  ok  uptime=290s  dana login: OK
21:40:17  ok  uptime=369s  dana login: OK
monitor during the failed deploy: 133 checks, 133 ok
```

**Recover (~21:49):** the correct Internal Database URL pasted back → *Save and deploy* → live.

**Critical path after recovery (21:53:56):** dana logged in → submitted REQ-1013
(AI-checked) → karim assigned it.

**User impact:** none.

<!-- screenshot (optional): Render Events showing "Deploy failed" -->

### Unplanned finding - the app can be "healthy" and still useless

The first attempt at this drill changed a character in the **database name** part of
the URL instead of the password. Postgres does not refuse an unknown database name the
way it refuses a wrong password: `prisma db push` in the start command **created a
new, empty database** with that name, the deploy succeeded, and from **~21:14 to
~21:34** the live app ran against it.

- `/health` said `ok`, `database: up` the whole time - the database *answered*.
- The monitor raised **no alert**.
- **Only a real login revealed it:** dana's correct password was refused (`401`) -
  the users table was empty.

The real data was never touched; pasting the correct URL back reconnected the app and
all 12 requests were there again. Two lessons:

- **Health proves the database is reachable, not that it is the right one.** Only
  exercising the critical path (sign in → submit → assign) catches this - which is
  what the final smoke test (`npm run smoke`, step 10) does, and why it is part of the
  release, not just the health check.
- **Why it could happen, and why it is kept on purpose.** The start command runs
  `prisma db push`, which compares `schema.prisma` with the database and applies only
  the differences - and creates the database if it is missing. While the project is
  still in development and the schema may still change, this keeps the schema in sync
  on every deploy: a schema change ships together with the code in one step, with no
  separate manual step to forget, and changes that would delete data are refused (the
  old version stays live). The one risk it adds - a wrong database name creating an
  empty database - is **caught by the critical-path smoke test** run on every release
  and recovery. Once the schema is stable, schema changes would move to a deliberate
  release step, so that a wrong database name fails to connect, `/health` returns
  `503`, and Render refuses the deploy like in drill 2.

---

## Drill 3 - Backend fully down

**Goal:** prove a full outage is detected immediately, and that the product degrades
visibly instead of disappearing.

**Break (21:56:42):** hub-backend → *Suspend Web Service*.

**Detected (21:56:45) - in 3 seconds:**

```
[9:56:41 PM] 200 ok       database=up ai=up
[9:56:42 PM] 503 error    database=? ai=?
[9:56:43 PM] 503 error    database=? ai=?
[9:56:45 PM] 503 error    database=? ai=?
[9:56:45 PM] ALERT - 3 bad checks in a row: ERROR
```

`database=?`: the `503` came from Render's "service suspended" answer, not from the
app - there was no app running to report anything. That is also why `/health` alone
cannot report a dead server; only something asking from outside notices.

**Frontend during the outage:** the static site (a separate Render service) still
loaded - users got the login page instead of a dead address - but nothing behind it
worked: signing in failed, so no requests could be seen, not even old ones. The
frontend holds no data of its own; everything it shows comes from the API. The
drill disproved an assumption made before it - that old requests would stay visible
while the backend is down.

**Recover:** *Resume Web Service*.

**Recovered (21:59:28)** - after the instance restarted:

```
[9:59:25 PM] UNREACHABLE (TimeoutError)
[9:59:28 PM] 200 ok       database=up ai=up
[9:59:28 PM] RECOVERED - healthy again after 120 bad checks
```

`/health` afterwards: `status=ok`, `uptime=71s` (a fresh instance), `release=9febf26`.

**Critical path after recovery (22:00:33):** dana logged in → submitted REQ-1014
(AI-checked) → karim assigned it.

**User impact:** ~2 min 46 s of no API (the time to click *Resume* and restart);
the page itself stayed up.

<!-- screenshot (optional): Render Events showing the suspend and resume -->

---

## Summary

| Drill | Failure | Detected by | Time to detect | User impact | Recovered by |
|---|---|---|---|---|---|
| 1 | AI key broken | monitor `ALERT: DEGRADED`, `/health`, `ai_fail_open` log | ~2 s after the bad version went live | none - requests saved *Not checked* | restoring the key |
| 2 | wrong DB password in a release | Render: deploy failed, `P1000` in the deploy log | at deploy | none - old version kept serving | restoring the URL |
| 2b | DB name pointed at an empty database (unplanned) | **only a real login** (`401`) | ~20 min | nobody could sign in | restoring the URL |
| 3 | backend suspended | monitor `ALERT: ERROR` | 3 s | ~2 min 46 s without the API | *Resume* |

Small blips seen during deploy switches (one timeout at 20:59:19, one `502` at
21:04:46) never raised an alert: the monitor needs 3 bad answers in a row, so a
single blip during a deploy does not wake anyone.

## Follow-ups from the drills

- **Critical-path smoke test** as part of every release and recovery - the only check
  that caught drill 2b.
- **Independent 24/7 alerting** (UptimeRobot keyword monitor on `/health`, every 5
  minutes, by email): the monitor script only watches while it runs.

## How to reproduce

Each drill uses only the Render dashboard and a terminal with Node:

```bash
npm run monitor -- https://hub-backend-5u3t.onrender.com   # watch while breaking and fixing
```

1. **AI outage:** hub-backend → Environment → make `GROQ_API_KEY` invalid → Save and
   deploy. Expect `degraded` + `ai_fail_open` in the logs; restore the key.
2. **Bad release:** make the *password* in `DATABASE_URL` wrong → Save and deploy.
   Expect *Deploy failed* with `P1000`, and the old version still serving; restore it.
   (Change the password, not the database name - see the unplanned finding above.)
3. **Backend down:** Settings → Suspend Web Service. Expect `503` → `ALERT`; Resume
   and expect `RECOVERED`.

After each recovery, run the critical path (sign in as `dana`, submit an IT request,
sign in as `karim`, assign it).

The drills created requests REQ-1011 to REQ-1014 on the live data; the database is
reseeded before submission.

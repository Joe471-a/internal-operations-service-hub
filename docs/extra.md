# Extra: Visibility, Login, Dashboard, and Responsive Frontend

This is a working notes doc, not a graded milestone doc like `week2-`/`week3-`/`week4-` - it records what was added *after* v0.4 (AI classification) so this work is easy to explain later: role-based visibility on the request list, a restructured and more visually finished frontend that fits both laptop and large screens, and a real login system.

## Visibility: who sees what in the request list

Before this pass, `GET /requests` returned every request in the system to whoever asked, with no actor scoping at all - the only actor-aware check in the app was on a single request (`GET /requests/:id`, via `canViewHistory` in `actors.ts`). That meant the frontend fetched and held the entire system's requests in the browser regardless of who was signed in, even though the table only *displayed* what made sense.

That's now fixed at the source, not just hidden in the UI.

### The rule

`GET /requests` reuses `actors.ts`'s existing `canViewHistory` rule instead of inventing a second one:
- **Employee** - only requests they submitted themselves.
- **Staff / Lead** - their own requests, **or** any request in their own department, regardless of status or who submitted it.

One rule, defined once, used both for "may I open this one request" (`getById`) and "which requests show up in my list at all" (`getVisible`). This is enforced in `backend/src/requests/requests.service.ts`, in the Prisma `where` clause itself - not filtered client-side after the fact - so the browser never receives a request the signed-in actor isn't allowed to see in the first place.

### Filter tabs on top of that

An optional `?view=` query parameter narrows the base scope further. The frontend surfaces this as tabs above the "All Requests" table:

| `view` | Meaning | Who gets the tab |
|---|---|---|
| *(omitted)* / `all` | The full base scope above | everyone (default) |
| `mine` | Just what this actor submitted | staff, lead |
| `handle` | Department requests currently `ASSIGNED` or `IN_PROGRESS` - the ones `request:handle` lets them move forward | staff, lead |
| `assign` | Department requests currently `SUBMITTED` - awaiting assign/deny | lead only |

In the sidebar the tabs appear as **My Requests, All, To Handle, Awaiting Assign/Deny** (My Requests first, since it's the person's own work). An employee gets no tabs at all - their list is already just their own, so there's nothing to narrow. For an actor with no department (only employees), `handle`/`assign` return an empty list rather than an error.

### Staff can see the assign/deny queue - they just can't act on it

This is deliberate, not an oversight: a staff member's **default "All" view has no status filter at all** - it's their own requests, or their whole department, at any status, including `SUBMITTED` ones nobody has assigned yet. Staff only don't get the *dedicated* "Awaiting Assign/Deny" filter tab (that's lead-only, since only a lead can act on it) - but the underlying visibility already includes those requests in the default view, so staff can see what's waiting to be triaged and what will land on them once a lead assigns it.

Action buttons in the table follow the app's existing "always offer, let the backend refuse" pattern - they're rendered by the request's status alone, never by whether the viewer is actually allowed to click them. So a staff member sees the same Assign/Deny buttons a lead would see on a `SUBMITTED` request in their department; clicking one still gets a real `403` from `authorizeTransition`, since staff never has `request:assign`/`request:deny`. The point isn't to hide the button - it's to let staff see their department's incoming work (including what's still awaiting a lead's decision) without being able to make that decision themselves.

### API contract changes

`GET /requests`:
- Now knows who is asking (previously this endpoint ignored it). At the time that was the `x-hub-actor` header; since the real login below, it is the signed-in user from the session token. No or invalid session → `401`, same as every other endpoint.
- New optional `?view=mine|handle|assign|all`. Invalid value → `400`.
- The old `?department=`/`?status=` query parameters are retired from this endpoint - they were actor-unscoped (an unauthenticated way to see any department's queue) and the frontend never used them. The underlying `getQueue()` method (and an equally unused `getAll()`) were later removed from `requests.service.ts` as dead code - nothing called them, and `getQueue` had no actor scoping, so keeping it around risked being re-routed by mistake.

### Tests

`requests.service.test.ts` gained a `getVisible` suite (fake Prisma, asserts the exact `where` clause built per role/view - employee scoping, staff/lead scoping, each `view` narrowing correctly, the empty-without-a-query result for an employee on `handle`/`assign`, the unknown-actor and invalid-view rejections). The backend suite was 69 tests at that point (60 after v0.4); later work brought it to 120 (see `week5-release-operations.md`).

## Frontend: component structure

The single 315-line `App.tsx` from v0.3/v0.4 has been split into focused pieces. `App.tsx` is now just the container - state, handlers, composition:

```
frontend/src/
├── App.tsx                # container: state, handlers, composition
├── api/requests.ts        # every call to the backend (login, requests, change password)
├── lib/
│   ├── constants.ts       # DEPARTMENTS, form examples, per-role sidebar tabs, which views show the dashboard
│   ├── session.ts         # the signed-in session (token, role, department) in localStorage
│   ├── format.ts          # formatStatus, formatTime, actorName
│   ├── theme.ts           # light/dark theme, remembered in localStorage
│   ├── useCountUp.ts      # animates the numbers on the stat cards
│   └── useMediaQuery.ts   # lets the table drop columns on narrower windows
└── components/
    ├── LoginPage.tsx
    ├── Sidebar.tsx            # brand, "New Request", and the view tabs (My Requests / All / To Handle / Awaiting Assign/Deny)
    ├── TopBar.tsx             # breadcrumb, search, theme toggle, session menu
    ├── ThemeToggle.tsx
    ├── SessionMenu.tsx        # topbar identity chip - change password / log out
    ├── StatsOverview.tsx      # count-per-status cards, computed client-side from the already-fetched list
    ├── StatCard.tsx           # one card of that row
    ├── RequestTable.tsx       # the table + per-status action buttons + expandable History row
    ├── HistoryPanel.tsx
    ├── SubmitPage.tsx         # the "Submit a Request" page (form + tips)
    ├── RequestForm.tsx
    ├── StatusBadge.tsx
    ├── AiCheckBadge.tsx
    ├── DepartmentBadge.tsx
    ├── Avatar.tsx             # initials circle next to a person's name
    └── Toast.tsx              # the "request submitted" confirmation
```

`api/requests.ts`'s `fetchAll()` became `fetchVisible(view?)` - it sends `Authorization: Bearer <token>` (see "Real login" below) and forwards `view` as a query parameter.

## Dashboard visual pass

On top of the corporate-panel look introduced earlier (cards, shadows, hover/focus states), this pass added:

- A stats overview row (`StatsOverview.tsx`) above the request list - one card per status, count computed from whatever the signed-in actor can already see. Clicking a card filters the list to that status. (Submitting a request later moved to its own page, opened from **New Request** in the sidebar.)
- A colored gradient header banner in place of the plain bordered header.
- Department color-coding (`DepartmentBadge.tsx`) - a distinct color per department (IT/HR/Finance), used consistently in the request table, the history panel, and as an accent on the submit form's department selector.
- The view-tabs described above, styled as a pill-button group with an active state.

No business logic changed in this visual pass - it's presentation only, reading data that already existed.

## Responsive layout: laptop and large screens

I checked the interface on both a laptop and a large monitor, since the request table was wider than a laptop screen and pushed the History button off the edge. It now fits without sideways scrolling at every screen width I tried: the table's Title column takes whatever space is left, and as the window narrows the least essential columns (AI Check, then Last Updated, then Dept) are left out of the table, since that information is still in each row's History panel. On a large monitor there is room to spare, so Last Updated shows on one line and names are no longer cut off. The columns shown are chosen in `RequestTable.tsx` (via a small `useMediaQuery` hook) and the widths are in `App.css`. Presentation only - no business logic changed.

## Real login (not a week 4 deliverable)

Not part of the assignment - an extra pass added afterward so the hub behaves like a real internal tool instead of a name-picker demo.

**Before → Now**

| | Before | Now |
|---|---|---|
| Identity | An `x-hub-actor: <id>` header - the browser could set it to anything | Signed in with a username + password |
| Password | Didn't exist | Stored hashed (bcrypt) in a real `User` table |
| Proof of identity | None - a request just claimed an id and was believed | A signed session token (JWT), checked on every request |
| Switching who you are | Pick a different actor from a dropdown, any time | Log out, log back in as someone else |

**New endpoints**

| Endpoint | Body | Result |
|---|---|---|
| `POST /auth/login` | `{ username, password }` | `401` on a wrong username or password; otherwise a session token + who you are |
| `POST /auth/change-password` | `{ currentPassword, newPassword }` | Requires a valid session token; still re-checks the current password before changing it |

**What changed, in short:**
- `actors.ts` now only holds the role rules (who may do what) - it no longer holds the list of people. That list moved into a real `User` table, read through a new `UsersService`.
- A new `auth` module owns proving identity: `AuthService` checks the password, `AuthGuard` checks the session token on every `/requests` call.
- `requests.controller.ts` now gets the actor from that verified token instead of trusting whatever id the browser sent in a header.
- Frontend: the "Acting as" dropdown is gone. `LoginPage.tsx` is the only way in; `SessionMenu.tsx` (top bar) replaces it with **Change password** / **Log out**. The session token lives in `localStorage` and rides along as `Authorization: Bearer <token>` on every request.

**Test credentials** (seeded by `npm run db:setup`, hashed in the DB - listed here only so this is testable; if a password is changed through the app, this table will *not* reflect that change). These are public demo accounts with fake data - on the live app anyone can sign in with them, and reseeding the database restores every password (see `week5-release-operations.md`, remaining risks):

| Username | Password | Person |
|---|---|---|
| dana | dana123 | Dana Karam — Employee |
| yara | yara123 | Yara Fakhoury — IT Staff |
| karim | karim123 | Karim Rahal — IT Lead |
| sami | sami123 | Sami Nassar — HR Lead |
| tarek | tarek123 | Tarek Sleiman — Finance Staff |
| layla | layla123 | Layla Haddad — Finance Lead |

## Changes during Week 5

Product changes made while preparing the release - each small, each with a reason.

**Request numbers.** Requests used to get a random id (`REQ-5ef6b338`). They are now
numbered by the database itself - PostgreSQL's auto-increment hands out the next
number on every insert - and shown as `REQ-1006`, `REQ-1007`, ... after the seeded
`REQ-1001`-`REQ-1005`. Because the database assigns the number, two requests
submitted at the same moment can never get the same id (a test submits ten at once
and checks for ten different ids). The API uses the plain number (`/requests/1006`);
anything else in the URL is refused with `400`.

**Closed requests in their own section.** For staff and leads, Completed and Denied
requests - where nobody can act any more - move to a *Closed* section below the open
queue, so the queue only holds work that still needs someone. Clicking a status card
still shows a single list of that status. An employee's list stays one list.

**Length limits.** A title can be at most 120 characters and a description 2,000,
refused with `400` before the AI is asked - so what reaches the model stays bounded.
The form stops at the same limits while typing.

**Two people acting at once.** If two actions on the same request arrive together
(a double-click, or a staff member and a lead both pressing *Start*), only the first
is applied; the second gets `409` asking to refresh. The update only happens if the
request is still in the status that was checked, and a test fires both at once
against the real database to prove it.

**Live refresh.** The request list reloads itself every 20 seconds while it is on
screen, so a status changed by someone else - a lead assigning your request - appears
without clicking or reloading. It pauses while the browser tab is hidden and skips a
round while you are acting or reading a History panel. Checked with two people at
once: dana's screen showed *Assigned* 20 seconds after karim assigned her request,
with no action on her side.

**One sign-in per tab.** The session is kept per browser tab (`sessionStorage`)
instead of per browser, so signing in as someone else in another tab never changes
who the first tab is - before, the second sign-in replaced the first, and the first
tab's next request quietly ran as the other person. A refresh keeps you signed in; a
new tab starts signed out.

## How to verify

```bash
npm install
docker compose up -d                     # local PostgreSQL (see docker-compose.yml)
cp backend/.env.example backend/.env     # then fill in the values - see README.md
npm run db:setup --workspace backend     # tables + the six demo accounts and five requests
npm run dev                              # backend :3000, frontend :5173
npm test                                 # 120 backend tests
```

Or skip the setup and use the live app: <https://hub-frontend-xtup.onrender.com> (same accounts).

Manually, log in as each account above (credentials table). As Dana (employee) - only her own requests, no filter tabs, no Actions column (nothing to act on your own request). Log out, log in as Yara or Karim (IT) - now also IT department requests, with My Requests / All / To Handle tabs (plus Awaiting Assign/Deny for Karim). The status dashboard shows on My Requests and All, and is hidden on To Handle and Awaiting Assign/Deny, where the list is already a single slice of statuses, and an Actions column on requests submitted by someone else. Log in as Sami or Layla (HR/Finance) and confirm IT-only requests never appear at all, not just hidden from view.

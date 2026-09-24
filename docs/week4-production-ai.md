# Production AI: Request Intake Classification (v0.4)

> **Note:** this describes the v0.4 milestone. Real login was added
> afterwards ([extra.md](extra.md)), which changes a few surrounding details:
> the person submitting is identified by a signed session token rather than
> an actor header, their role and department come from the `User` table, and
> `npm test` now runs 76 tests rather than the 60 counted below. The AI
> intake logic itself (the flow, Rule A, Rule B, fail-open) is unchanged.

One AI-assisted capability added to the existing request flow: when an
employee submits a request, its free text is classified by a real language
model and checked against two rules, before the request is ever written.
Directly answers what used to be an open Unknown in `docs/product-spec.md` -
"does the employee select the department, or should the system determine
it?" - *now removed from that doc*, since this feature answers it. Also
addresses the underlying problem it pointed at: requests getting "sent to
the wrong person."

The AI is advisory infrastructure, not an authority. It never writes to the
database and never decides anything by itself - it answers one narrow
question, and ordinary product code (this repo's, not the model's) decides
what to do with that answer.

## The flow

`POST /requests` (`requests.controller.ts` -> `RequestsService.create()`)
is unchanged up to the point where title, description and department are
already validated, exactly as in v0.3. From there, new work happens before
the Prisma write:

1. `AiClassificationService.checkIntake()` asks `GroqClassifierClient` to
   classify the title + description into a department.
2. If the model could not be reached, timed out, or answered with something
   unusable - **fail open**: the request is still created, marked
   `aiVerified: false`. Required by `docs/product-spec.md`'s own Graceful
   Degradation NFR: "if a non-critical feature becomes unavailable, users
   should still be able to access and manage requests."
3. If the model honestly answered "I cannot tell" (`department: null`) -
   **rejected**, `400`. This is a data problem, not an availability one, so
   it does not fail open.
4. If the classified department does not match the declared one - **Rule A**
   rejects, `400`.
5. If the actor is staff/lead of the classified department - **Rule B**
   rejects, `403`.
6. Otherwise the request is created, marked `aiVerified: true`.

## The AI boundary

- **Provider**: Groq, free tier, no paid account - an OpenAI-compatible
  `/v1/chat/completions` endpoint.
- **Model**: `openai/gpt-oss-20b` is OpenAI's open-weight model -
  free to run anywhere, including on Groq's own hardware - not OpenAI's paid
  API; no OpenAI account or billing is involved anywhere in this flow.
- **What crosses the boundary**: only the request's `title` and
  `description`. Never the actor's identity, never the department the
  employee declared - kept out on purpose, so the model classifies the
  content itself rather than being told (or swayed by) what the employee
  claims it is.
- **What comes back**: exactly `{ department: "IT" | "HR" | "FINANCE" | null }`,
  nothing else. `parseClassification()` (`groq-classifier.client.ts`)
  rebuilds a clean object from checked fields only - any other key the model
  adds (a confidence score, an explanation, anything) is read never, kept
  never. A `null` department is a real, allowed answer, not a failure - the
  system prompt is explicit that the model should say so rather than guess.
- **Files**: `backend/src/ai-classification/` - `classification.contract.ts`
  (the shape), `groq-classifier.client.ts` (talks to Groq, validates the
  answer, throws one error type - `ClassificationFailedError` - for every
  kind of failure), `ai-classification.service.ts` (the two rules and the
  unclear-input rejection, all product decisions, not the model's),
  `ai-classification.module.ts` (wiring).

## Rule A - content must match the declared department

An employee cannot describe an IT problem and file it under HR. The
classified department and the declared department must match, or the
request is rejected with `400` naming the department it actually looks
like (e.g. *"This looks like an IT request, not HR. Please resubmit it to
the right department."*). Applies to everyone who can submit - employee,
staff, or lead.

## Rule B - staff and leads may not file to their own department

An IT staff member or lead should resolve an IT problem directly, not file
a formal request to their own department's queue. If the classified
department equals the actor's own department, the request is rejected with
`403` (e.g. *"Yara Fakhoury (IT Staff) should resolve this directly rather
than file a request to their own department."*). Employees have no home
department (`department: null` on their user account), so this can never apply to
them - only staff and leads. Cross-department requests by staff/leads
(an IT lead filing an HR-matching request) are unaffected.

**This rule was requested and built as a first pass, and may change** - it
is one reasonable reading of how department staff should use their own
system, not a requirement pulled from `product-spec.md`.
A company could prefer to have the request noted and saved even if it is on the same department.

## Unclear input - an honest "I cannot tell" is rejected, not guessed

Text like `"idk"` / `"idk"` gives the model nothing to classify. Rather
than forcing a guess, the model may answer `department: null`, and the hub rejects the request with
`400` and a message asking for more detail: *"Please describe your request
in enough detail for us to route it - we could not tell what department
this belongs to."* This does not fail open - the model was successfully
consulted and gave a real, honest answer; there is nothing unavailable
about it, so waving it through would not be advisory caution, just noise
reaching a department queue.

## Fail-open - the AI being unavailable never blocks a submission

If Groq cannot be reached, times out, or answers with something the hub
cannot parse or trust, neither rule runs and the request is created anyway,
marked `aiVerified: false`. Same Graceful Degradation requirement as above:
the AI check is helpful when it works, but a third-party free-tier provider
being down must never stop an employee from filing a real request.
`aiVerified` is what
makes that distinction visible after the fact - a `false` value on an old
request means it was never actually checked, not that it passed.

## The `aiVerified` field

Persisted on `ServiceRequest` (`schema.prisma`), not just returned once in
the create response - so a staff member or lead opening the request later
(`GET /requests/:id`, or the list views) can still see whether it was ever
AI-checked. Threaded through `RequestResult`/`toResult()`, so it appears on
every read path (`getAll`, `getQueue`, `getById`, and `create`'s own
response). The five original seed requests are all `aiVerified: false` -
they predate this feature and were genuinely never checked; marking them
`true` would have been a false record.

Surfaced in the frontend as an "AI Check" badge/column on the request table
and in the History panel ("AI-checked" / "Not checked").

## API contract changes

`POST /requests` - unchanged body and headers. New possible responses,
alongside the existing ones from `docs/week3-full-stack-delivery.md`:

| Response | When |
|---|---|
| 400 | the request's content does not match the declared department (Rule A), or the model could not tell what department it belongs to |
| 403 | actor is staff/lead of the department the content actually belongs to (Rule B) |

The response body (`RequestResult`) gains one field: `aiVerified: boolean`.

## Tests

Two kinds, answering two different questions.

**"Is our code correct?" - `npm test`, 60 tests at v0.4 (76 today, after the login work in extra.md), ~2s, no internet needed.**
The original 28 tests are unchanged; 32 new ones were added:

| File | Tests | What it checks |
|---|---|---|
| `groq-classifier.client.test.ts` | 21 | Reading Groq's answer safely - accepts a real department or `null`, rejects everything else, handles every kind of network/HTTP failure. Uses a fake response instead of a real call. |
| `ai-classification.service.test.ts` | 11 | The rules themselves - Rule A, Rule B, the unclear-input rejection, and fail-open. Uses a fake classifier instead of a real one. |

**"Does the real AI still behave? " - `npm run eval:classification`, 17 cases, needs a real `GROQ_API_KEY`.**
A separate command, not part of `npm test`. It makes real calls to Groq to
check the model itself still classifies realistic examples sensibly -
clear cases, vague input, one-sided input (a strong word in only the title
or only the description must not carry the classification), ambiguous
input, and a couple of edge cases
(Rule B against a real answer, a real fail-open, and one bonus check that
the model resists being talked out of its job). Not a pass/fail gate.

## Out of scope for this milestone

No confidence threshold or partial-match handling beyond the binary
match/mismatch of Rule A. No retry/backoff on a failed Groq call - one
attempt, then fail open. No way for an employee to appeal or override a
rejected request; they simply resubmit. No admin visibility into how often
`aiVerified` is `false` in production. Rule B, as noted above, is a
first-pass rule and may be revisited.

## How to verify

```bash
npm install
npm run db:setup --workspace backend
# copy backend/.env.example to backend/.env and set a real GROQ_API_KEY
# (free - https://console.groq.com/keys)
npm run dev              # backend :3000, frontend :5173
npm test                  # 76 backend tests (60 at v0.4; login work added the rest)
npm run eval:classification   # 17 cases against the real Groq API
npm run test:all        # unit tests, then the e2e test, then the AI evals (one command for everything)
```

Manually, signed in with the test accounts from
[README.md](../README.md) (log out from the top bar to switch), and with
`GROQ_API_KEY` set:

| Sign in as | Submit | Expected |
|---|---|---|
| `dana` (employee) | an IT problem (e.g. VPN keeps disconnecting) under **HR** | 400, says it looks like IT |
| `dana` | an HR question (e.g. leave policy) under **IT** | 400, says it looks like HR |
| `yara` (IT staff) | an IT problem under **IT** | 403, staff/leads don't file to their own department |
| `tarek` (Finance staff) | an IT problem under **IT** | succeeds - IT isn't his department |
| `dana` | `idk` / `idk` | 400, asks for more detail |
| `dana` | a generic title (`help`) with a vague description | 400, cannot tell the department |
| `dana` | a description that just repeats the title | 400, cannot tell the department |
| `dana` | a real IT description under an unrelated filler title | 400, cannot tell the department |
| `dana` | a clear title and a matching description, under the right department | succeeds, `aiVerified: true` (response, and "AI-checked" in the UI) |
| `dana`, after blanking `GROQ_API_KEY` in `backend/.env` and restarting | anything well-formed | still succeeds, `aiVerified: false` ("Not checked") |

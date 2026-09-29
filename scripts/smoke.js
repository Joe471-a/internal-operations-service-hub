/**
 * The critical-path smoke test: runs the hub's main journey against a real
 * backend and ends in GO or NO-GO.
 *
 *   npm run smoke                                   the local backend
 *   npm run smoke -- https://hub-backend-5u3t.onrender.com   the live app
 *
 * Health alone is not enough: /health can say "ok" while the app is pointed
 * at the wrong (empty) database - see docs/week5-failure-drills.md, drill 2b.
 * This signs in and does real work, so that case fails here.
 *
 * It creates one request titled "[smoke] ..." each run. Exits 0 on GO and 1
 * on NO-GO, so it can gate a release as well as be read by a person. Needs
 * only Node - no install, no database, no .env.
 */

const DEFAULT_BASE_URL = 'http://localhost:3000';
// The first call may wake a sleeping free-tier backend (30-50 s).
const FIRST_CALL_TIMEOUT_MS = 90_000;
const CALL_TIMEOUT_MS = 20_000;

const base = (process.argv[2] || DEFAULT_BASE_URL).replace(/\/+$/, '').replace(/\/health$/, '');
let failed = false;

async function call(method, path, { token, body, timeout = CALL_TIMEOUT_MS } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });
  return { status: response.status, data: await response.json().catch(() => null) };
}

/** Runs one step; a thrown error or a false check fails it, and the run. */
async function step(name, run) {
  try {
    const detail = await run();
    console.log(`PASS  ${name}${detail ? `  (${detail})` : ''}`);
    return true;
  } catch (error) {
    failed = true;
    console.log(`FAIL  ${name}  -> ${error.message}`);
    return false;
  }
}

function expectStatus(result, expected, what) {
  if (result.status !== expected) {
    const reason = result.data && result.data.message ? `: ${result.data.message}` : '';
    throw new Error(`${what} answered ${result.status}, expected ${expected}${reason}`);
  }
}

async function signIn(username) {
  const result = await call('POST', '/auth/login', { body: { username, password: `${username}123` } });
  expectStatus(result, 200, `sign-in as ${username}`);
  return result.data.token;
}

async function main() {
  console.log(`Smoke test against ${base}\n`);
  const tokens = {};
  let requestId;

  const healthy = await step('health is ok or degraded', async () => {
    const result = await call('GET', '/health', { timeout: FIRST_CALL_TIMEOUT_MS });
    if (result.status !== 200 || !result.data) throw new Error(`/health answered ${result.status}`);
    const { status, database, ai, release } = result.data;
    if (status === 'degraded') console.log(`WARN  AI is ${ai} - requests will be saved "Not checked" (fail-open)`);
    return `status=${status} database=${database} ai=${ai} release=${release}`;
  });

  // Nothing further can work without a healthy backend.
  if (healthy) {
    await step('a wrong password is refused', async () => {
      const result = await call('POST', '/auth/login', { body: { username: 'dana', password: 'not-her-password' } });
      expectStatus(result, 401, 'sign-in with a wrong password');
    });

    const signedIn = await step('dana signs in', async () => {
      tokens.dana = await signIn('dana');
    });

    const submitted =
      signedIn &&
      (await step('dana submits an IT request', async () => {
        const result = await call('POST', '/requests', {
          token: tokens.dana,
          body: {
            title: '[smoke] Laptop will not turn on',
            description: 'My laptop does not power on at all since this morning, even when plugged in.',
            department: 'IT',
          },
        });
        expectStatus(result, 201, 'submitting the request');
        requestId = result.data.id;
        return `REQ-${requestId}, ${result.data.aiVerified ? 'AI-checked' : 'Not checked'}`;
      }));

    if (submitted) {
      await step('sami (HR lead) cannot assign an IT request', async () => {
        tokens.sami = await signIn('sami');
        const result = await call('POST', `/requests/${requestId}/transition`, { token: tokens.sami, body: { to: 'ASSIGNED' } });
        expectStatus(result, 403, 'assigning as the HR lead');
      });

      await step('karim (IT lead) assigns it', async () => {
        tokens.karim = await signIn('karim');
        const result = await call('POST', `/requests/${requestId}/transition`, { token: tokens.karim, body: { to: 'ASSIGNED' } });
        expectStatus(result, 200, 'assigning as the IT lead');
        return result.data.currentStatus;
      });

      await step('dana sees it assigned - the change was saved', async () => {
        const result = await call('GET', `/requests/${requestId}`, { token: tokens.dana });
        expectStatus(result, 200, 'reading the request back');
        if (result.data.currentStatus !== 'ASSIGNED') throw new Error(`status is ${result.data.currentStatus}, expected ASSIGNED`);
        return result.data.history.map((event) => event.status).join(' > ');
      });
    }
  }

  console.log(failed ? '\nSMOKE FAILED - NO-GO' : '\nSMOKE PASSED - GO');
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.log(`FAIL  could not run the smoke test -> ${error.message}`);
  console.log('\nSMOKE FAILED - NO-GO');
  process.exit(1);
});

/**
 * Reproducible check of the Request lifecycle milestone claim:
 *   - valid transitions succeed
 *   - invalid transitions are rejected
 *   - the "Completed is terminal" invariant holds
 *
 * Run with:  npm run verify   (from the repo root or from backend/)
 *
 * It builds the app, starts it on port 3000, runs the cases, prints
 * pass/fail, then stops the server. Exit code is non-zero if any case fails.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = 'http://localhost:3000';
const server = spawn('node', ['dist/main.js'], { stdio: 'ignore' });

let pass = 0;
let fail = 0;

async function waitReady() {
  for (let i = 0; i < 40; i++) {
    try {
      await fetch(`${BASE}/requests`);
      return true;
    } catch {
      await sleep(500);
    }
  }
  return false;
}

async function check(name, method, path, body, expectStatus, expectText) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const ok = res.status === expectStatus && (!expectText || text.includes(expectText));
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  console.log(`      ${method} ${path}  ->  HTTP ${res.status}${res.status === expectStatus ? '' : `  (expected ${expectStatus})`}`);
  console.log(`      ${text}`);
  console.log();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

try {
  if (!(await waitReady())) {
    console.error('Server did not start on port 3000 (is something else using it?).');
    process.exit(1);
  }

  const created = await check('CREATE - POST /requests makes a request in "Submitted"',
    'POST', '/requests', null, 201, '"currentStatus":"Submitted"');
  const id = created.id;

  await check('VALID 1 - Submitted -> Assigned',
    'POST', `/requests/${id}/transition`, { to: 'Assigned' }, 200, '"currentStatus":"Assigned"');

  await check('VALID 2 - Assigned -> In Progress',
    'POST', `/requests/${id}/transition`, { to: 'In Progress' }, 200, '"currentStatus":"In Progress"');

  const other = await (await fetch(`${BASE}/requests`, { method: 'POST' })).json();

  await check('INVALID 1 - Submitted -> Completed (skips steps)',
    'POST', `/requests/${other.id}/transition`, { to: 'Completed' }, 409, 'is not allowed');

  await check('INVALID 2 - not a real status',
    'POST', `/requests/${other.id}/transition`, { to: 'Banana' }, 400, 'not a valid request status');

  await check('INVARIANT - REQ-1003 (Completed) -> In Progress is rejected',
    'POST', '/requests/REQ-1003/transition', { to: 'In Progress' }, 409, 'terminal state');

  await check('INVARIANT check - REQ-1003 is still Completed',
    'GET', '/requests/REQ-1003', null, 200, '"currentStatus":"Completed"');

  await check('BONUS - unknown id -> 404',
    'POST', '/requests/REQ-0000/transition', { to: 'Assigned' }, 404, 'not found');

  console.log(`${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
} finally {
  server.kill();
}

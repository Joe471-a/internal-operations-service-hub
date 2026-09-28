/**
 * Watches /health every second and raises an alert when it stays bad.
 *
 *   npm run monitor                                   the local backend
 *   npm run monitor -- https://your-app.onrender.com  the live app
 *
 * Prints one line per check. "Bad" is anything but ok: degraded (the AI
 * check is off), error (the database is down), or unreachable (no answer -
 * the server itself is down). One bad answer can be a blip, so the alert
 * only fires after ALERT_AFTER bad answers in a row, once per streak, and a
 * RECOVERED line follows when the hub is ok again.
 *
 * It only reports. It never restarts anything - a degraded hub still works,
 * and deciding what to do is the operator's job, not this script's.
 * Stop it with Ctrl + C.
 */

const { healthUrl, askHealth } = require('./health-url');

const INTERVAL_MS = 1000;
const ALERT_AFTER = 3;

const url = healthUrl();
let badInARow = 0;
let alerting = false;

function describe(result) {
  if (result.status === 'unreachable') return `UNREACHABLE (${result.reason})`;
  const { database = '?', ai = '?' } = result.report;
  return `${result.httpStatus} ${result.status.padEnd(8)} database=${database} ai=${ai}`;
}

async function tick() {
  const result = await askHealth(url);
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] ${describe(result)}`);

  if (result.status === 'ok') {
    if (alerting) {
      console.log(`[${time}] RECOVERED - healthy again after ${badInARow} bad checks`);
    }
    badInARow = 0;
    alerting = false;
  } else {
    badInARow += 1;
    if (badInARow === ALERT_AFTER) {
      alerting = true;
      console.log(`[${time}] ALERT - ${ALERT_AFTER} bad checks in a row: ${result.status.toUpperCase()}`);
    }
  }

  // The next check starts only after this one has finished, so a slow answer
  // never piles up overlapping requests.
  setTimeout(tick, INTERVAL_MS);
}

console.log(`Monitoring ${url} every ${INTERVAL_MS / 1000}s - alert after ${ALERT_AFTER} bad checks in a row. Ctrl + C to stop.`);
tick();

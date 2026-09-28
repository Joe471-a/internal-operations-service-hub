/**
 * Asks /health once and prints the answer.
 *
 *   npm run health                                   the local backend
 *   npm run health -- https://your-app.onrender.com  the live app
 *
 * Exits 0 when the hub can work (ok or degraded - it fails open without the
 * AI) and 1 when it cannot (error, or no answer at all), so it can be used
 * as a check in a script as well as read by a person.
 */

const { healthUrl, askHealth } = require('./health-url');

async function main() {
  const url = healthUrl();
  const result = await askHealth(url);

  console.log(`GET ${url}`);
  if (result.status === 'unreachable') {
    console.log(`UNREACHABLE - no answer (${result.reason}). Is the backend running?`);
  } else {
    // Only what says whether the hub works. release, uptimeSeconds and
    // checkedAt are still in /health itself - open it for the full report.
    const { status, database, ai } = result.report;
    console.log(`${result.httpStatus} ${JSON.stringify({ status, database, ai })}`);
  }

  process.exit(result.status === 'ok' || result.status === 'degraded' ? 0 : 1);
}

main();

/**
 * Shared by health.js and monitor.js: which /health to ask, and how to ask it.
 *
 * The URL is the first command-line argument, or the local backend if none
 * is given - so the same script works on a laptop and against the live app:
 *   npm run health
 *   npm run health -- https://your-app.onrender.com
 */

const DEFAULT_BASE_URL = 'http://localhost:3000';

function healthUrl() {
  const base = (process.argv[2] || DEFAULT_BASE_URL).replace(/\/+$/, '');
  return base.endsWith('/health') ? base : `${base}/health`;
}

/**
 * One call to /health, always resolving to something printable.
 * "unreachable" is its own state: no answer at all means the server itself
 * is down, which /health cannot report about itself.
 */
async function askHealth(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const report = await response.json().catch(() => ({}));
    return { httpStatus: response.status, status: report.status || 'error', report };
  } catch (error) {
    return { httpStatus: null, status: 'unreachable', report: {}, reason: error.cause?.code || error.name };
  }
}

module.exports = { healthUrl, askHealth };

import { log } from './log';

/** Only what the logger reads - never the body, never the headers. */
export interface LoggedRequest {
  method: string;
  originalUrl: string;
  actor?: { id: string };
}

export interface LoggedResponse {
  statusCode: number;
  on(event: 'finish', listener: () => void): unknown;
}

/**
 * One line per request, written when the response has been sent:
 *   {"event":"request","method":"POST","path":"/requests","status":201,"ms":142,"actor":"emp-001"}
 *
 * - `actor` is who was signed in (set by AuthGuard), absent before login.
 * - `path` drops the query string - only the route is recorded.
 * - A 5xx is logged as an error; everything else, refusals included, is a
 *   normal request (a 403 is a rule doing its job, not a fault).
 * - Healthy /health checks are skipped: the monitor and Render ask every
 *   few seconds, and those lines would bury everything else. An unhealthy
 *   answer is still logged.
 * - Browser CORS preflights (OPTIONS) are skipped: each one only precedes
 *   the real request, which is logged itself.
 */
export function requestLogger(req: LoggedRequest, res: LoggedResponse, next: () => void): void {
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  const startedAt = performance.now();
  res.on('finish', () => {
    const path = req.originalUrl.split('?')[0];
    const status = res.statusCode;
    if (path === '/health' && status < 400) return;

    log(status >= 500 ? 'error' : 'info', 'request', {
      method: req.method,
      path,
      status,
      ms: Math.round(performance.now() - startedAt),
      actor: req.actor?.id,
    });
  });
  next();
}

import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JsonNestLogger } from './json-nest-logger';
import { log } from './log';
import { LoggedRequest, requestLogger } from './request-logger';

/**
 * The log lines themselves: what goes in, what is left out on purpose, and
 * that every one of them is a single parseable JSON object.
 */

let out: ReturnType<typeof vi.spyOn>;
let warn: ReturnType<typeof vi.spyOn>;
let err: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  out = vi.spyOn(console, 'log').mockImplementation(() => {});
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  err = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Every line written, parsed back from JSON, in order, whatever its level. */
function lines() {
  return [out, warn, err]
    .flatMap((spy) => spy.mock.calls.map((call: unknown[]) => String(call[0])))
    .map((line) => JSON.parse(line));
}

/** A request that finishes with `status` once the logger is attached. */
function handle(req: Partial<LoggedRequest> & Record<string, unknown>, status: number) {
  const res = Object.assign(new EventEmitter(), { statusCode: status });
  const next = vi.fn();
  requestLogger({ method: 'GET', originalUrl: '/requests', ...req } as LoggedRequest, res, next);
  res.emit('finish');
  return next;
}

describe('log', () => {
  it('writes one JSON line with the time, level, event and fields', () => {
    log('info', 'startup', { release: 'a728a16', port: 3000 });

    expect(out).toHaveBeenCalledTimes(1);
    const [line] = lines();
    expect(line).toMatchObject({ level: 'info', event: 'startup', release: 'a728a16', port: 3000 });
    expect(new Date(line.time).toString()).not.toBe('Invalid Date');
  });

  it('sends warnings and errors to their own streams', () => {
    log('warn', 'a');
    log('error', 'b');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalledTimes(1);
  });
});

describe('one line per request', () => {
  it('records the method, route, status, time taken and who was signed in', () => {
    const next = handle({ method: 'POST', originalUrl: '/requests', actor: { id: 'emp-001' } }, 201);

    expect(next).toHaveBeenCalledTimes(1);
    const [line] = lines();
    expect(line).toMatchObject({ level: 'info', event: 'request', method: 'POST', path: '/requests', status: 201, actor: 'emp-001' });
    expect(typeof line.ms).toBe('number');
  });

  it('leaves the actor out before anyone has signed in', () => {
    handle({ method: 'POST', originalUrl: '/auth/login' }, 401);

    expect(lines()[0]).not.toHaveProperty('actor');
  });

  it('records a refusal as a normal request - a 403 is a rule working', () => {
    handle({ originalUrl: '/requests/1001' }, 403);

    expect(lines()[0]).toMatchObject({ level: 'info', status: 403 });
  });

  it('records a server failure as an error', () => {
    handle({}, 500);

    expect(err).toHaveBeenCalledTimes(1);
    expect(lines()[0]).toMatchObject({ level: 'error', status: 500 });
  });

  it('drops the query string, keeping only the route', () => {
    handle({ originalUrl: '/requests?view=handle' }, 200);

    expect(lines()[0].path).toBe('/requests');
  });

  it('never writes the body or the headers - no password or token can reach a log', () => {
    handle(
      {
        method: 'POST',
        originalUrl: '/auth/login',
        body: { username: 'dana', password: 'dana123' },
        headers: { authorization: 'Bearer secret.token.value' },
      },
      200,
    );

    const written = JSON.stringify(lines());
    expect(written).not.toContain('dana123');
    expect(written).not.toContain('secret.token.value');
  });

  it('skips healthy /health checks, which would otherwise bury everything else', () => {
    handle({ originalUrl: '/health' }, 200);

    expect(lines()).toEqual([]);
  });

  it('still logs /health when it is unhealthy', () => {
    handle({ originalUrl: '/health' }, 503);

    expect(lines()[0]).toMatchObject({ path: '/health', status: 503 });
  });

  it('skips browser CORS preflights, and still lets them through', () => {
    const next = handle({ method: 'OPTIONS' }, 204);

    expect(lines()).toEqual([]);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("Nest's own messages", () => {
  it('turns an unexpected crash into an error line with its stack trace and context', () => {
    const crash = new Error("Can't reach database server");
    new JsonNestLogger().error(crash.message, crash.stack, 'ExceptionsHandler');

    const [line] = lines();
    expect(line).toMatchObject({ level: 'error', event: 'nest', context: 'ExceptionsHandler', message: "Can't reach database server" });
    expect(line.stack).toContain('logging.test.ts');
  });

  it("drops Nest's routine startup chatter", () => {
    new JsonNestLogger().log('Mapped {/requests, GET} route', 'RouterExplorer');

    expect(lines()).toEqual([]);
  });
});

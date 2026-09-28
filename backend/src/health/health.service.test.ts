import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GroqClassifierClient } from '../ai-classification/groq-classifier.client';
import { PrismaService } from '../prisma.service';
import { HealthController } from './health.controller';
import { AI_CHECK_TTL_MS, DATABASE_TIMEOUT_MS, HealthService } from './health.service';

/**
 * The health check, on its own.
 *
 * No real database and no real Groq - a fake Prisma whose one query answers,
 * fails, or never answers at all, and a fake Groq client whose ping either
 * succeeds or throws. Those are the things the two real dependencies can do
 * to a health check.
 */

const databaseUp = async () => [{ '?column?': 1 }];
const databaseDown = async () => {
  throw new Error("Can't reach database server");
};
const aiUp = async () => {};
const aiDown = async () => {
  throw new Error('Groq unreachable');
};

function healthWith(queryRaw: () => Promise<unknown>, ping: () => Promise<void>) {
  const prisma = { $queryRaw: queryRaw };
  const groq = { ping: vi.fn(ping) };
  const service = new HealthService(
    prisma as unknown as PrismaService,
    groq as unknown as GroqClassifierClient,
  );
  return { service, groq, controller: new HealthController(service) };
}

beforeEach(() => {
  vi.stubEnv('GROQ_API_KEY', 'test-key');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('ok - everything works', () => {
  it('reports ok, and the controller returns it as a normal 200 body', async () => {
    const { controller } = healthWith(databaseUp, aiUp);

    const report = await controller.check();

    expect(report).toMatchObject({ status: 'ok', database: 'up', ai: 'up' });
  });
});

describe('degraded - the hub works, the AI check is off', () => {
  it('is still a 200 when Groq is down - the hub fails open, so nothing may restart it', async () => {
    const { controller } = healthWith(databaseUp, aiDown);

    const report = await controller.check();

    expect(report).toMatchObject({ status: 'degraded', database: 'up', ai: 'down' });
  });

  it('is degraded when there is no key, without calling Groq at all', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    const { controller, groq } = healthWith(databaseUp, aiUp);

    const report = await controller.check();

    expect(report).toMatchObject({ status: 'degraded', ai: 'not configured' });
    expect(groq.ping).not.toHaveBeenCalled();
  });
});

describe('error - the database is unreachable', () => {
  it('answers 503 with the same report, so the caller still sees what is down', async () => {
    const { controller } = healthWith(databaseDown, aiUp);

    const error = await controller.check().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    const body = (error as ServiceUnavailableException).getResponse();
    expect(body).toMatchObject({ status: 'error', database: 'down' });
  });

  it('is error, not degraded, when the AI is down as well - the database decides', async () => {
    const { service } = healthWith(databaseDown, aiDown);

    const report = await service.check();

    expect(report.status).toBe('error');
  });

  it('gives up after the timeout when the database never answers, instead of hanging', async () => {
    vi.useFakeTimers();
    const { service } = healthWith(() => new Promise(() => {}), aiUp);

    const pending = service.check();
    await vi.advanceTimersByTimeAsync(DATABASE_TIMEOUT_MS);
    const report = await pending;

    expect(report).toMatchObject({ status: 'error', database: 'down' });
  });
});

describe('the AI check is reused, not repeated every second', () => {
  it('asks Groq once per window, however often health is called', async () => {
    vi.useFakeTimers();
    const { service, groq } = healthWith(databaseUp, aiUp);

    await service.check();
    await service.check();
    await service.check();
    expect(groq.ping).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(AI_CHECK_TTL_MS);
    await service.check();
    expect(groq.ping).toHaveBeenCalledTimes(2);
  });
});

describe('what else the report says', () => {
  it('names the running release from the commit Render deployed', async () => {
    vi.stubEnv('RENDER_GIT_COMMIT', '2271594a8f3c1e9b7d0000000000000000000000');
    const { service } = healthWith(databaseUp, aiUp);

    const report = await service.check();

    expect(report.release).toBe('2271594');
  });
});

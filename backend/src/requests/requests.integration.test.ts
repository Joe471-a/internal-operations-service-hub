import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { NotFoundException } from '@nestjs/common';
import { config } from 'dotenv';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AiClassificationService } from '../ai-classification/ai-classification.service';
import { PrismaService } from '../prisma.service';
import { UsersService } from '../users/users.service';
import { RequestsService } from './requests.service';

// The fixtures the app itself is seeded from — one definition, so a test can
// never quietly disagree with the app about what REQ-1001 is.
import { resetFixtures } from '../../prisma/fixtures';
import { resetUsers } from '../../prisma/users';

/**
 * The rules and the database, together.
 *
 * Everything here is real: a real PrismaClient, a real Postgres database, the
 * real service. What is being checked is not what the method returned - it
 * is what the hub still believes afterwards, read back out of the database
 * with a second, independent query.
 *
 * The tests run against their own database (hub_test), next to the app's
 * own database on the same Postgres server - DATABASE_URL with only the
 * database name swapped. The app's database is never opened here, so
 * running this suite cannot disturb what is seeded there.
 */

const BACKEND_DIR = resolve(__dirname, '../..');
config({ path: resolve(BACKEND_DIR, '.env') });

function testDatabaseUrl(): string {
  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) {
    throw new Error(
      'DATABASE_URL is not set. Copy backend/.env.example to backend/.env and start Postgres with "docker compose up -d".',
    );
  }
  const url = new URL(devUrl);
  url.pathname = '/hub_test';
  return url.toString();
}

let prisma: PrismaService;
let service: RequestsService;

beforeAll(async () => {
  const testUrl = testDatabaseUrl();

  // Creates hub_test if it does not exist yet and brings its tables in line
  // with schema.prisma - the same step db:setup runs for the app's database.
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: BACKEND_DIR,
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'ignore',
  });

  prisma = new PrismaService({ datasourceUrl: testUrl });
  // This suite exercises transition(), not create(), so the classifier is
  // never actually called - a stub just needs to satisfy the constructor.
  const stubAiClassification = { checkIntake: async () => ({ aiVerified: true }) };
  // A real UsersService against the same test database - the six seeded
  // users are reference data this suite never mutates, so they are reset
  // once here rather than before every test.
  await resetUsers(prisma);
  const users = new UsersService(prisma);
  service = new RequestsService(prisma, stubAiClassification as unknown as AiClassificationService, users);
  // prisma db push alone takes several seconds - well past Vitest's default
  // 10s for a hook on a busy machine.
}, 60_000);

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Every test starts from the same five requests, so no test can depend on
  // another one having run first.
  await resetFixtures(prisma);
});

/**
 * Reads a request straight out of the (test) database, past the service.
 * History is ordered explicitly, the same way the service orders it -
 * PostgreSQL, unlike SQLite, makes no promise to return rows in the order
 * they were inserted, and this suite reinserts rows before every test.
 */
async function readBack(id: string) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    include: { history: { orderBy: { id: 'asc' } } },
  });
  if (!request) throw new Error(`${id} is missing from the test database`);
  return request;
}

describe('assigning a request, for real', () => {
  it('is visible in the database once the IT lead assigns it', async () => {
    const before = await readBack('REQ-1001');
    expect(before.currentStatus).toBe('SUBMITTED');
    expect(before.history).toHaveLength(1);

    await service.transition('REQ-1001', 'ASSIGNED', 'it-lead-001');

    const after = await readBack('REQ-1001');
    expect(after.currentStatus).toBe('ASSIGNED');
    expect(after.history).toHaveLength(2);
    expect(after.history.map((event) => event.status)).toEqual(['SUBMITTED', 'ASSIGNED']);
  });

  /**
   * The one that matters most.
   *
   * When the hub refuses a move, the database must end up exactly where it
   * started. Not nearly. Exactly.
   */
  it('changes nothing at all when a different department tries', async () => {
    await expect(
      service.transition('REQ-1001', 'ASSIGNED', 'hr-lead-001'),
    ).rejects.toMatchObject({ status: 403 });

    const after = await readBack('REQ-1001');
    expect(after.currentStatus).toBe('SUBMITTED');
    expect(after.history).toHaveLength(1);
  });
});

/**
 * Regression protection.
 *
 * These are the exact claims backend/verify.mjs made about the Week 2
 * in-memory milestone. Nothing about adding Prisma, actors or department
 * scoping was supposed to change any of them - this proves it didn't.
 */
describe('regression: the original request lifecycle still holds', () => {
  it('moves a request through its full lifecycle, one legal step at a time', async () => {
    await service.transition('REQ-1005', 'ASSIGNED', 'hr-lead-001');
    await service.transition('REQ-1005', 'IN_PROGRESS', 'hr-lead-001');
    const done = await service.transition('REQ-1005', 'COMPLETED', 'hr-lead-001');

    expect(done.currentStatus).toBe('COMPLETED');
    expect(done.history.map((event) => event.status)).toEqual([
      'SUBMITTED',
      'ASSIGNED',
      'IN_PROGRESS',
      'COMPLETED',
    ]);
  });

  it('still refuses to move a completed request (REQ-1003)', async () => {
    await expect(
      service.transition('REQ-1003', 'IN_PROGRESS', 'it-lead-001'),
    ).rejects.toMatchObject({ status: 409 });

    const after = await readBack('REQ-1003');
    expect(after.currentStatus).toBe('COMPLETED');
  });

  it('still rejects a status that does not exist', async () => {
    await expect(
      service.transition('REQ-1001', 'Banana', 'it-lead-001'),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('still answers an unknown id with 404', async () => {
    await expect(
      service.transition('REQ-0000', 'ASSIGNED', 'it-lead-001'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

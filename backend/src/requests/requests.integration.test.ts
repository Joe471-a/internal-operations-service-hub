import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NotFoundException } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../prisma.service';
import { RequestsService } from './requests.service';

// The fixtures the app itself is seeded from — one definition, so a test can
// never quietly disagree with the app about what REQ-1001 is.
import { resetFixtures } from '../../prisma/fixtures';

/**
 * The rules and the database, together.
 *
 * Everything here is real: a real PrismaClient, a real SQLite file, the real
 * service. What is being checked is not what the method returned - it is
 * what the hub still believes afterwards, read back out of the database
 * with a second, independent query.
 *
 * The tests run against their own database file (test.db, copied from
 * hub.db once below). The app's hub.db is never opened for anything but
 * that one copy, so running this suite cannot disturb what is seeded there.
 */

const DEV_DB = resolve(__dirname, '../../prisma/hub.db');
const TEST_DB = resolve(__dirname, '../../prisma/test.db');

let prisma: PrismaService;
let service: RequestsService;

beforeAll(() => {
  if (!existsSync(DEV_DB)) {
    throw new Error(
      `No database found at ${DEV_DB}. Run "npm run db:setup --workspace backend" once first.`,
    );
  }

  // Copy the development database to get its tables, then empty it below.
  // This is why the tests need no migration step of their own - and why
  // hub.db itself is never written to by anything in this file.
  copyFileSync(DEV_DB, TEST_DB);

  // An absolute file: path on purpose - a relative one would be read as
  // relative to the Prisma schema, not to this test.
  prisma = new PrismaService({ datasourceUrl: `file:${TEST_DB}` });
  service = new RequestsService(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Every test starts from the same five requests, so no test can depend on
  // another one having run first.
  await resetFixtures(prisma);
});

/** Reads a request straight out of the (test) database, past the service. */
async function readBack(id: string) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    include: { history: true },
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

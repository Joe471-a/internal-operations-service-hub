import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { PrismaService } from '../prisma.service';
import { RequestsService } from './requests.service';

/**
 * The rules, on their own.
 *
 * No database, no network, no NestJS wiring. RequestsService is just a
 * class, so the test builds one by hand and hands it a fake Prisma.
 *
 * That fake does more than stop the test from touching a real database: it
 * counts. A refusal is only a real refusal if nothing happened, so every
 * denial test below also asks "and did you leave the fake database alone?"
 */

/** A database that hands back one request and records any attempt to write. */
function fakePrisma(request: Record<string, unknown> | null) {
  const updates: unknown[] = [];
  const creates: unknown[] = [];
  return {
    updates,
    creates,
    serviceRequest: {
      findUnique: async () => (request ? { history: [], ...request } : null),
      update: async (args: { data: Record<string, unknown> }) => {
        updates.push(args);
        return { ...request, ...args.data, history: [] };
      },
      create: async (args: { data: Record<string, unknown> }) => {
        creates.push(args);
        // args.data.history is Prisma's nested-create input shape, not a
        // real history array - override it after the spread, same as update().
        return { ...args.data, history: [] };
      },
    },
  };
}

/** REQ-1001 as the hub knows it: an IT request, freshly submitted. */
const IT_SUBMITTED_REQUEST = {
  id: 'REQ-1001',
  title: "Laptop won't turn on",
  description: 'My laptop does not power on at all.',
  department: 'IT',
  currentStatus: 'SUBMITTED',
  submittedBy: 'emp-001',
  lastUpdated: '2026-09-01T09:05:00',
};

/** Builds a real RequestsService wired to the fake Prisma above. */
function buildService(request: Record<string, unknown> | null) {
  const prisma = fakePrisma(request);
  const service = new RequestsService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe('who may assign or deny a request', () => {
  it('refuses a lead from a different department, and writes nothing', async () => {
    const { service, prisma } = buildService(IT_SUBMITTED_REQUEST);

    await expect(
      service.transition('REQ-1001', 'ASSIGNED', 'hr-lead-001'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // The refusal has to happen before anything else does. If the hub had
    // already written a row, the answer would still be "no" - but it would
    // be a "no" that already changed something.
    expect(prisma.updates).toEqual([]);
  });

  it('refuses IT staff - right department, wrong role - and writes nothing', async () => {
    const { service, prisma } = buildService(IT_SUBMITTED_REQUEST);

    await expect(
      service.transition('REQ-1001', 'ASSIGNED', 'it-staff-001'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.updates).toEqual([]);
  });

  it('lets the IT lead assign an IT request', async () => {
    const { service, prisma } = buildService(IT_SUBMITTED_REQUEST);

    const result = await service.transition('REQ-1001', 'ASSIGNED', 'it-lead-001');

    expect(result.currentStatus).toBe('ASSIGNED');
    expect(prisma.updates).toHaveLength(1);
    expect(prisma.updates[0]).toMatchObject({ data: { currentStatus: 'ASSIGNED' } });
  });

  it('lets the IT lead deny an IT request instead', async () => {
    const { service, prisma } = buildService(IT_SUBMITTED_REQUEST);

    await service.transition('REQ-1001', 'DENIED', 'it-lead-001');

    expect(prisma.updates).toHaveLength(1);
    expect(prisma.updates[0]).toMatchObject({ data: { currentStatus: 'DENIED' } });
  });
});

describe('who may view a request', () => {
  it('lets a staff member of the same department view it, even one submitted by someone else', async () => {
    const { service } = buildService(IT_SUBMITTED_REQUEST); // department: 'IT', submittedBy: 'emp-001'

    const result = await service.getById('REQ-1001', 'it-staff-001');

    expect(result?.id).toBe('REQ-1001');
  });

  it('lets a lead of the same department view it too', async () => {
    const { service } = buildService(IT_SUBMITTED_REQUEST);

    const result = await service.getById('REQ-1001', 'it-lead-001');

    expect(result?.id).toBe('REQ-1001');
  });

  it("refuses a lead of a different department who didn't submit it", async () => {
    const { service } = buildService(IT_SUBMITTED_REQUEST); // IT request, HR lead has no part in it

    await expect(service.getById('REQ-1001', 'hr-lead-001')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a lead view a request from another department that they submitted themselves', async () => {
    // hr-lead-001 can submit to any department, then must still be able to see their own request.
    const { service } = buildService({ ...IT_SUBMITTED_REQUEST, submittedBy: 'hr-lead-001' });

    const result = await service.getById('REQ-1001', 'hr-lead-001');

    expect(result?.id).toBe('REQ-1001');
  });

  it('lets an employee view a request they submitted themselves', async () => {
    const { service } = buildService(IT_SUBMITTED_REQUEST); // submittedBy: 'emp-001'

    const result = await service.getById('REQ-1001', 'emp-001');

    expect(result?.id).toBe('REQ-1001');
  });

  it("refuses an employee viewing someone else's request", async () => {
    const { service } = buildService({ ...IT_SUBMITTED_REQUEST, submittedBy: 'some-other-employee' });

    await expect(service.getById('REQ-1001', 'emp-001')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('an actor the hub does not recognise', () => {
  it('is refused before anything about the request is even considered', async () => {
    const { service, prisma } = buildService(IT_SUBMITTED_REQUEST);

    await expect(
      service.transition('REQ-1001', 'ASSIGNED', 'ghost-001'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.updates).toEqual([]);
  });

  it('is refused when just looking a request up too', async () => {
    const { service } = buildService(IT_SUBMITTED_REQUEST);

    await expect(service.getById('REQ-1001', 'ghost-001')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('submitting a request', () => {
  it('rejects a request with no title, and writes nothing', async () => {
    const { service, prisma } = buildService(null);

    await expect(
      service.create(undefined, 'a real description', 'IT', 'emp-001'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.creates).toEqual([]);
  });

  it('rejects a request for a department that does not exist, and writes nothing', async () => {
    const { service, prisma } = buildService(null);

    await expect(
      service.create('Need help', 'a real description', 'LEGAL', 'emp-001'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.creates).toEqual([]);
  });

  it('lets any known actor submit a well-formed request', async () => {
    const { service, prisma } = buildService(null);

    const result = await service.create('Need help', 'a real description', 'IT', 'emp-001');

    expect(result.department).toBe('IT');
    expect(prisma.creates).toHaveLength(1);
  });
});

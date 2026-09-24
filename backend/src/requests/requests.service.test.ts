import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AiClassificationService } from '../ai-classification/ai-classification.service';
import { PrismaService } from '../prisma.service';
import { UsersService } from '../users/users.service';
import { Actor } from './actors';
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

/**
 * A stand-in for AiClassificationService that never talks to a model.
 * Defaults to "matches, no conflict" so every existing test below keeps
 * behaving exactly as it did before the AI check existed - the AI rules
 * themselves are tested on their own, in ai-classification.service.test.ts.
 */
function fakeAiClassification() {
  return { checkIntake: async () => ({ aiVerified: true }) };
}

/**
 * A stand-in for UsersService - the same six known actors the app is
 * seeded with, resolved without touching a real database. Any id outside
 * this list (e.g. 'ghost-001') resolves to null, same as an unknown user
 * would from the real, DB-backed service.
 */
const KNOWN_ACTORS: Record<string, Actor> = {
  'emp-001': {
    id: 'emp-001',
    displayName: 'Dana Karam (Employee)',
    role: 'employee',
    department: null,
    permissions: ['request:submit'],
  },
  'it-staff-001': {
    id: 'it-staff-001',
    displayName: 'Yara Fakhoury (IT Staff)',
    role: 'staff',
    department: 'IT',
    permissions: ['request:submit', 'request:handle'],
  },
  'it-lead-001': {
    id: 'it-lead-001',
    displayName: 'Karim Rahal (IT Lead)',
    role: 'lead',
    department: 'IT',
    permissions: ['request:submit', 'request:handle', 'request:assign', 'request:deny'],
  },
  'hr-lead-001': {
    id: 'hr-lead-001',
    displayName: 'Sami Nassar (HR Lead)',
    role: 'lead',
    department: 'HR',
    permissions: ['request:submit', 'request:handle', 'request:assign', 'request:deny'],
  },
  'finance-staff-001': {
    id: 'finance-staff-001',
    displayName: 'Tarek Sleiman (Finance Staff)',
    role: 'staff',
    department: 'FINANCE',
    permissions: ['request:submit', 'request:handle'],
  },
  'finance-lead-001': {
    id: 'finance-lead-001',
    displayName: 'Layla Haddad (Finance Lead)',
    role: 'lead',
    department: 'FINANCE',
    permissions: ['request:submit', 'request:handle', 'request:assign', 'request:deny'],
  },
};

function fakeUsers() {
  return {
    resolveActor: async (id?: string) => (id && KNOWN_ACTORS[id] ? KNOWN_ACTORS[id] : null),
  };
}

/** Builds a real RequestsService wired to the fake Prisma above. */
function buildService(request: Record<string, unknown> | null) {
  const prisma = fakePrisma(request);
  const service = new RequestsService(
    prisma as unknown as PrismaService,
    fakeAiClassification() as unknown as AiClassificationService,
    fakeUsers() as unknown as UsersService,
  );
  return { service, prisma };
}

/**
 * A database whose findMany just records the `where` it was asked for.
 * getVisible's job is building the right Prisma filter per actor/view -
 * actually applying that filter is Prisma's job, covered by the real-DB
 * integration tests, so this fake only has to prove the filter is correct.
 */
function fakePrismaFindMany() {
  const wheres: unknown[] = [];
  return {
    wheres,
    serviceRequest: {
      findMany: async (args: { where: unknown }) => {
        wheres.push(args.where);
        return [];
      },
    },
  };
}

function buildVisibilityService() {
  const prisma = fakePrismaFindMany();
  const service = new RequestsService(
    prisma as unknown as PrismaService,
    fakeAiClassification() as unknown as AiClassificationService,
    fakeUsers() as unknown as UsersService,
  );
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

describe('who sees what in the request list (getVisible)', () => {
  it('scopes an employee to only their own requests', async () => {
    const { service, prisma } = buildVisibilityService();

    await service.getVisible('emp-001');

    expect(prisma.wheres).toEqual([{ submittedBy: 'emp-001' }]);
  });

  it('scopes staff to their own requests or their whole department', async () => {
    const { service, prisma } = buildVisibilityService();

    await service.getVisible('it-staff-001');

    expect(prisma.wheres).toEqual([
      { OR: [{ submittedBy: 'it-staff-001' }, { department: 'IT' }] },
    ]);
  });

  it('scopes a lead the same way staff are scoped - own requests or their department', async () => {
    const { service, prisma } = buildVisibilityService();

    await service.getVisible('it-lead-001');

    expect(prisma.wheres).toEqual([
      { OR: [{ submittedBy: 'it-lead-001' }, { department: 'IT' }] },
    ]);
  });

  it('"mine" narrows down to just what this actor submitted', async () => {
    const { service, prisma } = buildVisibilityService();

    await service.getVisible('it-staff-001', 'mine');

    expect(prisma.wheres).toEqual([
      {
        AND: [
          { OR: [{ submittedBy: 'it-staff-001' }, { department: 'IT' }] },
          { submittedBy: 'it-staff-001' },
        ],
      },
    ]);
  });

  it('"handle" narrows to department requests that are Assigned or In Progress', async () => {
    const { service, prisma } = buildVisibilityService();

    await service.getVisible('it-staff-001', 'handle');

    expect(prisma.wheres).toEqual([
      {
        AND: [
          { OR: [{ submittedBy: 'it-staff-001' }, { department: 'IT' }] },
          { department: 'IT', currentStatus: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
        ],
      },
    ]);
  });

  it('"assign" narrows to department requests awaiting Submitted -> Assigned/Denied', async () => {
    const { service, prisma } = buildVisibilityService();

    await service.getVisible('it-lead-001', 'assign');

    expect(prisma.wheres).toEqual([
      {
        AND: [
          { OR: [{ submittedBy: 'it-lead-001' }, { department: 'IT' }] },
          { department: 'IT', currentStatus: 'SUBMITTED' },
        ],
      },
    ]);
  });

  it('"handle" and "assign" are always empty for an employee, and never even query', async () => {
    const { service, prisma } = buildVisibilityService();

    expect(await service.getVisible('emp-001', 'handle')).toEqual([]);
    expect(await service.getVisible('emp-001', 'assign')).toEqual([]);
    expect(prisma.wheres).toEqual([]);
  });

  it('rejects a view that is not one of all/mine/handle/assign', async () => {
    const { service, prisma } = buildVisibilityService();

    await expect(service.getVisible('it-lead-001', 'everything')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.wheres).toEqual([]);
  });

  it('refuses an actor the hub does not recognise, before any query', async () => {
    const { service, prisma } = buildVisibilityService();

    await expect(service.getVisible('ghost-001')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.wheres).toEqual([]);
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

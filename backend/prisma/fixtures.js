/**
 * Internal Operations Service Hub — the requests the Academy works with.
 *
 * This is the single place that decides what the hub starts out believing.
 * The seed script writes these into the development database, and the tests
 * write these same rows into their own database. One definition, two
 * readers: a test can never quietly disagree with the app about what
 * REQ-1001 is.
 *
 * Actor ids here (emp-001, it-staff-001, ...) are the same ids actors.ts
 * resolves — the fixtures do not define who those people are, only that a
 * request was touched by them.
 */

const REQUESTS = [
  {
    id: 'REQ-1001',
    title: "Laptop won't turn on",
    description: 'My laptop does not power on at all, and I have a client meeting this afternoon.',
    department: 'IT',
    currentStatus: 'SUBMITTED',
    submittedBy: 'emp-001',
    lastUpdated: '2026-09-01T09:05:00',
    history: [['SUBMITTED', '2026-09-01T09:05:00', 'emp-001']],
  },
  {
    id: 'REQ-1002',
    title: 'Need VPN access restored',
    description: 'VPN client keeps disconnecting every few minutes since the update.',
    department: 'IT',
    currentStatus: 'IN_PROGRESS',
    submittedBy: 'emp-001',
    lastUpdated: '2026-09-02T14:20:00',
    history: [
      ['SUBMITTED', '2026-09-01T11:30:00', 'emp-001'],
      ['ASSIGNED', '2026-09-02T08:45:00', 'it-lead-001'],
      ['IN_PROGRESS', '2026-09-02T14:20:00', 'it-staff-001'],
    ],
  },
  {
    id: 'REQ-1003',
    title: 'New monitor request',
    description: 'Requesting a second monitor for the new hire desk setup.',
    department: 'IT',
    currentStatus: 'COMPLETED',
    submittedBy: 'emp-001',
    lastUpdated: '2026-09-03T16:15:00',
    history: [
      ['SUBMITTED', '2026-08-31T10:00:00', 'emp-001'],
      ['ASSIGNED', '2026-09-01T09:10:00', 'it-lead-001'],
      ['IN_PROGRESS', '2026-09-02T10:05:00', 'it-staff-001'],
      ['COMPLETED', '2026-09-03T16:15:00', 'it-staff-001'],
    ],
  },
  {
    id: 'REQ-1004',
    title: 'Install unapproved software',
    description: 'Requesting local admin rights to install a personal video editor.',
    department: 'IT',
    currentStatus: 'DENIED',
    submittedBy: 'emp-001',
    lastUpdated: '2026-09-01T13:05:00',
    history: [
      ['SUBMITTED', '2026-09-01T12:40:00', 'emp-001'],
      ['DENIED', '2026-09-01T13:05:00', 'it-lead-001'],
    ],
  },
  {
    id: 'REQ-1005',
    title: 'Reimbursement question',
    description: 'Need clarification on the per-diem policy for the upcoming conference.',
    department: 'HR',
    currentStatus: 'SUBMITTED',
    submittedBy: 'emp-001',
    lastUpdated: '2026-09-04T10:00:00',
    history: [['SUBMITTED', '2026-09-04T10:00:00', 'emp-001']],
  },
];

/**
 * Puts the database back to exactly the five requests above.
 *
 * Deletes first, so it does not matter what a previous run left behind. Call
 * it before a test and the test starts from a world it fully knows.
 */
async function resetFixtures(prisma) {
  await prisma.requestEvent.deleteMany();
  await prisma.serviceRequest.deleteMany();

  for (const request of REQUESTS) {
    await prisma.serviceRequest.create({
      data: {
        id: request.id,
        title: request.title,
        description: request.description,
        department: request.department,
        currentStatus: request.currentStatus,
        submittedBy: request.submittedBy,
        lastUpdated: request.lastUpdated,
        history: {
          create: request.history.map(([status, occurredAt, actorId]) => ({
            status,
            occurredAt,
            actorId,
          })),
        },
      },
    });
  }
}

module.exports = { REQUESTS, resetFixtures };

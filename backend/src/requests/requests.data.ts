/**
 * Internal Operations Service Hub - prepared request data.
 *
 * This milestone keeps its data in memory so it can run without a database.
 * In the real system this would come from the relational database
 * (see decisions/ADR-003.md).
 *

 */

/** The statuses a Request can have ( product-spec.md + images/lifecycle.png). */
export type RequestStatus =
  | 'Submitted'
  | 'Assigned'
  | 'In Progress'
  | 'Completed'
  | 'Denied';

/** Every status value, as a plain array - used to validate incoming values. */
export const ALL_STATUSES: RequestStatus[] = [
  'Submitted',
  'Assigned',
  'In Progress',
  'Completed',
  'Denied',
];

/** One thing that happened to a request, and when it happened. */
export interface StatusChange {
  status: RequestStatus;
  occurredAt: string; // ISO 8601
}

/** Everything the hub remembers about one request. */
export interface RequestRecord {
  id: string;
  currentStatus: RequestStatus;
  lastUpdated: string;
  history: StatusChange[];
}

/**
 * The in-memory store. Starts with a few example requests so the API has
 * something to return right after `npm run dev` 
 * New requests are pushed here at runtime; restarting the server resets it.
 */
export const REQUESTS: RequestRecord[] = [
  {
    id: 'REQ-1001',
    currentStatus: 'Submitted',
    lastUpdated: '2026-09-01T09:05:00',
    history: [{ status: 'Submitted', occurredAt: '2026-09-01T09:05:00' }],
  },
  {
    id: 'REQ-1002',
    currentStatus: 'In Progress',
    lastUpdated: '2026-09-02T14:20:00',
    history: [
      { status: 'Submitted', occurredAt: '2026-09-01T11:30:00' },
      { status: 'Assigned', occurredAt: '2026-09-02T08:45:00' },
      { status: 'In Progress', occurredAt: '2026-09-02T14:20:00' },
    ],
  },
  {
    id: 'REQ-1003',
    currentStatus: 'Completed',
    lastUpdated: '2026-09-03T16:15:00',
    history: [
      { status: 'Submitted', occurredAt: '2026-08-31T10:00:00' },
      { status: 'Assigned', occurredAt: '2026-09-01T09:10:00' },
      { status: 'In Progress', occurredAt: '2026-09-02T10:05:00' },
      { status: 'Completed', occurredAt: '2026-09-03T16:15:00' },
    ],
  },
  {
    id: 'REQ-1004',
    currentStatus: 'Denied',
    lastUpdated: '2026-09-01T13:05:00',
    history: [
      { status: 'Submitted', occurredAt: '2026-09-01T12:40:00' },
      { status: 'Denied', occurredAt: '2026-09-01T13:05:00' },
    ],
  },
];

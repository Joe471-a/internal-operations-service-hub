/** This file is how the hub screen talks to the hub backend. */

const API_BASE_URL = 'http://localhost:3000';

/**
 * Who the screen is acting as. This is an identity only - the screen never
 * tells the backend what that identity is allowed to do. The backend
 * decides that itself (backend/src/requests/actors.ts).
 */
export type ActorId =
  | 'emp-001'
  | 'it-staff-001'
  | 'it-lead-001'
  | 'hr-lead-001'
  | 'finance-staff-001'
  | 'finance-lead-001';

export type Department = 'IT' | 'HR' | 'FINANCE';

export interface RequestEvent {
  status: string;
  occurredAt: string;
  actorId: string;
}

export interface ServiceRequest {
  id: string;
  title: string;
  description: string;
  department: Department;
  currentStatus: string;
  submittedBy: string;
  lastUpdated: string;
  history: RequestEvent[];
}

/**
 * One place where a hub answer becomes either a value or an Error.
 *
 * Exported so any future screen can reuse it, rather than every caller
 * remembering to check `ok` for itself.
 */
export async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? 'The hub could not answer right now.');
  }
  return response.json();
}

/** Every request, unfiltered - the system-wide view. */
export async function fetchAll(): Promise<ServiceRequest[]> {
  return readResponse<ServiceRequest[]>(await fetch(`${API_BASE_URL}/requests`));
}

/**
 * One request and its full history. Staff and leads may look up any
 * request; an employee may only look up one they submitted themselves -
 * the backend enforces this and refuses (403) otherwise.
 */
export async function fetchById(id: string, actorId: ActorId): Promise<ServiceRequest> {
  return readResponse<ServiceRequest>(
    await fetch(`${API_BASE_URL}/requests/${id}`, {
      headers: { 'x-hub-actor': actorId },
    }),
  );
}

export async function createRequest(
  title: string,
  description: string,
  department: Department,
  actorId: ActorId,
): Promise<ServiceRequest> {
  return readResponse<ServiceRequest>(
    await fetch(`${API_BASE_URL}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hub-actor': actorId },
      body: JSON.stringify({ title, description, department }),
    }),
  );
}

export async function transitionRequest(
  id: string,
  to: string,
  actorId: ActorId,
): Promise<ServiceRequest> {
  return readResponse<ServiceRequest>(
    await fetch(`${API_BASE_URL}/requests/${id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hub-actor': actorId },
      body: JSON.stringify({ to }),
    }),
  );
}

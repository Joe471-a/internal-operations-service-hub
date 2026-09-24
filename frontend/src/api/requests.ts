/** This file is how the hub screen talks to the hub backend. */

import { clearSession, getSession } from '../lib/session';

const API_BASE_URL = 'http://localhost:3000';

/**
 * The id a signed-in session identifies. The screen never chooses this
 * anymore - it comes back from `login()` and is carried in the session
 * token on every request after that.
 */
export type ActorId =
  | 'emp-001'
  | 'it-staff-001'
  | 'it-lead-001'
  | 'hr-lead-001'
  | 'finance-staff-001'
  | 'finance-lead-001';

export type Department = 'IT' | 'HR' | 'FINANCE';

/** The filter tabs the hub offers on top of an actor's base visibility. */
export type RequestView = 'all' | 'mine' | 'handle' | 'assign';

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
  aiVerified: boolean;
  currentStatus: string;
  submittedBy: string;
  lastUpdated: string;
  history: RequestEvent[];
}

export interface LoginResponse {
  token: string;
  actorId: ActorId;
  displayName: string;
  role: 'employee' | 'staff' | 'lead';
  department: Department | null;
}

/**
 * One place where a hub answer becomes either a value or an Error.
 *
 * A 401 also means the session is no longer good (expired, or nothing was
 * ever signed in) - clearing it here means every screen bounces back to the
 * login page on the very next render, not just on this one failed call.
 *
 * Exported so any future screen can reuse it, rather than every caller
 * remembering to check `ok` for itself.
 */
export async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
    }
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? 'The hub could not answer right now.');
  }
  return response.json();
}

/** The Authorization header for the signed-in session, or none if nobody is signed in. */
function authHeader(): Record<string, string> {
  const session = getSession();
  return session ? { Authorization: `Bearer ${session.token}` } : {};
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  return readResponse<LoginResponse>(
    await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),
  );
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await readResponse<{ ok: true }>(
    await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  );
}

/**
 * Every request the signed-in actor may see - their own, plus their whole
 * department if they're staff/lead. `view` narrows further into one of the
 * filter tabs ('mine' | 'handle' | 'assign'); omitted or 'all' means no
 * extra narrowing. The backend is what actually enforces this (actors.ts),
 * this call just asks for it correctly.
 */
export async function fetchVisible(view?: RequestView): Promise<ServiceRequest[]> {
  const query = view && view !== 'all' ? `?view=${view}` : '';
  return readResponse<ServiceRequest[]>(
    await fetch(`${API_BASE_URL}/requests${query}`, {
      headers: authHeader(),
    }),
  );
}

/**
 * One request and its full history. Staff and leads may look up any
 * request; an employee may only look up one they submitted themselves -
 * the backend enforces this and refuses (403) otherwise.
 */
export async function fetchById(id: string): Promise<ServiceRequest> {
  return readResponse<ServiceRequest>(
    await fetch(`${API_BASE_URL}/requests/${id}`, {
      headers: authHeader(),
    }),
  );
}

export async function createRequest(
  title: string,
  description: string,
  department: Department,
): Promise<ServiceRequest> {
  return readResponse<ServiceRequest>(
    await fetch(`${API_BASE_URL}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ title, description, department }),
    }),
  );
}

export async function transitionRequest(id: string, to: string): Promise<ServiceRequest> {
  return readResponse<ServiceRequest>(
    await fetch(`${API_BASE_URL}/requests/${id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ to }),
    }),
  );
}

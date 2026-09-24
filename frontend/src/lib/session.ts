import type { ActorId, Department } from '../api/requests';
import type { Role } from './constants';

/** What a successful login leaves the screen holding - the token is the only thing later requests actually send. */
export interface Session {
  token: string;
  actorId: ActorId;
  displayName: string;
  role: Role;
  department: Department | null;
}

const STORAGE_KEY = 'hub-session';

/** The signed-in session, or null if nobody is signed in (or storage is unavailable). */
export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(session: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // A session that can't persist still works for the rest of this tab.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage was never reachable.
  }
}

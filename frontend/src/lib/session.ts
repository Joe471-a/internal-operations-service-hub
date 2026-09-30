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

/**
 * Where the session lives: sessionStorage, so each browser tab has its own.
 * Signing in as someone else in another tab never changes who this tab is -
 * two people can be compared side by side in one browser. A refresh keeps the
 * session; a new tab starts signed out.
 */
const storage = () => sessionStorage;

/** The signed-in session, or null if nobody is signed in (or storage is unavailable). */
export function getSession(): Session | null {
  try {
    const raw = storage().getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(session: Session): void {
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // A session that can't persist still works for the rest of this tab.
  }
}

export function clearSession(): void {
  try {
    storage().removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage was never reachable.
  }
}

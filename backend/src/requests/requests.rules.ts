/**
 * The Request lifecycle rules - the state machine.
 *
 * Source of truth: docs/data-model.md ("Lifecycle + Rules")
 * and images/lifecycle.png.
 *
 * This file is pure logic: no HTTP, no storage, no NestJS, no authorization.
 * It answers one question - "may a request move from status X to status Y?"
 * Whether this *actor* is allowed to ask is a separate question, answered in
 * requests.service.ts with actors.ts - not here.
 */
import { RequestStatus, ALL_STATUSES } from './requests.data';

/**
 * For each status, the statuses it is allowed to move to next.
 * Completed and Denied have no outgoing transitions (they are terminal).
 */
export const ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  SUBMITTED: ['ASSIGNED', 'DENIED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  DENIED: [],
};

/** Statuses a request can never leave. */
export const TERMINAL_STATUSES: RequestStatus[] = ['COMPLETED', 'DENIED'];

export function isTerminal(status: RequestStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Runtime check that an unknown value is one of the 5 real statuses. */
export function isRequestStatus(value: unknown): value is RequestStatus {
  return typeof value === 'string' && (ALL_STATUSES as string[]).includes(value);
}

/** Why a transition was rejected. */
export type TransitionRejectionReason =
  | 'UNKNOWN_TARGET_STATUS'
  | 'TERMINAL_STATE'
  | 'UNDEFINED_TRANSITION';

export type TransitionCheck =
  | { allowed: true }
  | { allowed: false; reason: TransitionRejectionReason; message: string };

/**
 * Decide whether a request may move from `from` to `to`.
 *
 * Enforces the invariants:
 *  - every request must have a valid status
 *  - a completed request cannot move back to an earlier state (terminal)
 *  - only defined state transitions are allowed
 */
export function checkTransition(
  from: RequestStatus,
  to: unknown,
): TransitionCheck {
  if (!isRequestStatus(to)) {
    return {
      allowed: false,
      reason: 'UNKNOWN_TARGET_STATUS',
      message: `"${String(to)}" is not a valid request status.`,
    };
  }

  if (isTerminal(from)) {
    return {
      allowed: false,
      reason: 'TERMINAL_STATE',
      message: `Request is in terminal state "${from}" and cannot change status.`,
    };
  }

  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    return {
      allowed: false,
      reason: 'UNDEFINED_TRANSITION',
      message: `Transition "${from}" -> "${to}" is not allowed.`,
    };
  }

  return { allowed: true };
}

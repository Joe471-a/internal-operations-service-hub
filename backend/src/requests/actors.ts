import { Department } from '@prisma/client';

/**
 * Internal Operations Service Hub — what an identity is allowed to do.
 *
 * Proving *who* is asking is `auth/` and `users/`'s job now (a real login,
 * a hashed password, a signed session token, backed by the `User` table).
 * This file only ever answers the question that comes after that proof:
 * once the hub knows an actor's role and department, what may they do?
 * A caller can never send its own role or its own permissions - if it
 * could, the boundary would not be a boundary.
 */

/** The things the hub can allow or refuse. */
export type Permission =
  | 'request:submit'
  | 'request:handle'
  | 'request:assign'
  | 'request:deny';

export type Role = 'employee' | 'staff' | 'lead';

export interface Actor {
  id: string;
  displayName: string;
  role: Role;
  /** null for a plain employee - they do not belong to a department's queue. */
  department: Department | null;
  permissions: Permission[];
}

/**
 * What each role can do, department aside.
 *
 * From docs/data-model.md's "Set by" column, reframed as increasing
 * permission: an employee can only submit; staff can also handle a request
 * of their own department (Assigned -> In Progress -> Completed); a lead
 * can also assign or deny one (Submitted -> Assigned / Denied).
 */
export const PERMISSIONS_BY_ROLE: Record<Role, Permission[]> = {
  employee: ['request:submit'],
  staff: ['request:submit', 'request:handle'],
  lead: ['request:submit', 'request:handle', 'request:assign', 'request:deny'],
};

/** Whether the hub lets this actor do this, department aside. */
export function can(actor: Actor, permission: Permission): boolean {
  return actor.permissions.includes(permission);
}

/**
 * Whether this actor belongs to the department a request is in.
 *
 * Submitting is department-agnostic - anyone may ask any department for
 * help. Handling, assigning and denying are not: a lead or staff member only
 * acts on their own department's queue, never another one's.
 */
export function inSameDepartment(actor: Actor, department: Department): boolean {
  return actor.department === department;
}

/**
 * Whether this actor may view a request's detail and history.
 *
 * Anyone may look up a request they submitted themselves, regardless of
 * role or department - it is theirs. Beyond that: an employee has no
 * department queue at all, so they may look up nothing else (the
 * "employee_id -> requests" access pattern from docs/data-model.md). Staff
 * and leads additionally see every request in their own department, submitted
 * by them or not - reviewing a request a colleague already handled is normal
 * department work - but not another department's requests they had no part
 * in.
 */
export function canViewHistory(
  actor: Actor,
  request: { submittedBy: string; department: Department },
): boolean {
  if (request.submittedBy === actor.id) return true;
  if (actor.role === 'employee') return false;
  return inSameDepartment(actor, request.department);
}

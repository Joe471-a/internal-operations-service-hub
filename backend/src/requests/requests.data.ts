/**
 * Internal Operations Service Hub - shared request types.
 *
 * The request lifecycle rules (requests.rules.ts) and the Prisma-backed
 * service both read RequestStatus and Department from here, so there is one
 * definition instead of two that could quietly drift apart. The values
 * themselves come from the Prisma schema (see decisions/ADR-003.md) - this
 * file re-exports them, it does not redefine them.
 */
import { Department, RequestStatus } from '@prisma/client';

export { Department, RequestStatus };

/** Every status value, as a plain array - used to validate incoming values. */
export const ALL_STATUSES: RequestStatus[] = [
  RequestStatus.SUBMITTED,
  RequestStatus.ASSIGNED,
  RequestStatus.IN_PROGRESS,
  RequestStatus.COMPLETED,
  RequestStatus.DENIED,
];

/** Every department value, as a plain array - used to validate incoming values. */
export const ALL_DEPARTMENTS: Department[] = [Department.IT, Department.HR, Department.FINANCE];

/** Runtime check that an unknown value is one of the 3 real departments. */
export function isDepartment(value: unknown): value is Department {
  return typeof value === 'string' && (ALL_DEPARTMENTS as string[]).includes(value);
}

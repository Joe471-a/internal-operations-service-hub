import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { REQUESTS, RequestRecord, RequestStatus } from './requests.data';
import { checkTransition } from './requests.rules';

/**
 * The operations on requests.
 *
 * Storage is the in-memory REQUESTS array (requests.data.ts).
 * The lifecycle rules live in requests.rules.ts - this file only calls them
 * and translates the result into an HTTP response.
 */
@Injectable()
export class RequestsService {
  /** All requests (used for a system-wide view). */
  getAll(): RequestRecord[] {
    return REQUESTS;
  }

  /** One request by id, or undefined if there is none. */
  getById(id: string): RequestRecord | undefined {
    return REQUESTS.find((request) => request.id === id);
  }

  /** Create a new request. It always starts in "Submitted". */
  create(): RequestRecord {
    const now = new Date().toISOString();
    const record: RequestRecord = {
      id: `REQ-${randomUUID().slice(0, 8)}`,
      currentStatus: 'Submitted',
      lastUpdated: now,
      history: [{ status: 'Submitted', occurredAt: now }],
    };
    REQUESTS.push(record);
    return record;
  }

  /**
   * Move a request to a new status, if the lifecycle allows it.
   *  - unknown id            -> 404 Not Found
   *  - not a real status     -> 400 Bad Request
   *  - illegal transition    -> 409 Conflict (terminal state or undefined transition)
   */
  transition(id: string, to: unknown): RequestRecord {
    const record = this.getById(id);
    if (!record) {
      throw new NotFoundException(`Request "${id}" not found.`);
    }

    const check = checkTransition(record.currentStatus, to);
    if (!check.allowed) {
      if (check.reason === 'UNKNOWN_TARGET_STATUS') {
        throw new BadRequestException(check.message);
      }
      throw new ConflictException(check.message);
    }

    const now = new Date().toISOString();
    record.currentStatus = to as RequestStatus;
    record.lastUpdated = now;
    record.history.push({ status: to as RequestStatus, occurredAt: now });
    return record;
  }
}

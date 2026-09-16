import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { Actor, Permission, can, canViewHistory, inSameDepartment, resolveActor } from './actors';
import { ALL_DEPARTMENTS, Department, RequestStatus, isDepartment } from './requests.data';
import { checkTransition, isRequestStatus } from './requests.rules';

export interface RequestEvent {
  status: RequestStatus;
  occurredAt: string;
  actorId: string;
}

export interface RequestResult {
  id: string;
  title: string;
  description: string;
  department: Department;
  currentStatus: RequestStatus;
  submittedBy: string;
  lastUpdated: string;
  history: RequestEvent[];
}

type RequestWithHistory = Prisma.ServiceRequestGetPayload<{ include: { history: true } }>;

/**
 * The operations on requests.
 *
 * Storage is Prisma / SQLite (decisions/ADR-003.md). The lifecycle rules
 * live in requests.rules.ts (is this transition legal at all) and who-may-
 * ask lives in actors.ts (is this actor allowed to ask) - this file only
 * calls both, in that order, and translates the result into an HTTP
 * response.
 */
@Injectable()
export class RequestsService {
  constructor(private readonly prisma: PrismaService) {}

  private toResult(record: RequestWithHistory): RequestResult {
    return {
      id: record.id,
      title: record.title,
      description: record.description,
      department: record.department,
      currentStatus: record.currentStatus,
      submittedBy: record.submittedBy,
      lastUpdated: record.lastUpdated,
      history: [...record.history]
        .sort((a, b) => a.id - b.id)
        .map((event) => ({
          status: event.status,
          occurredAt: event.occurredAt,
          actorId: event.actorId,
        })),
    };
  }

  /** All requests (used for a system-wide view). */
  async getAll(): Promise<RequestResult[]> {
    const requests = await this.prisma.serviceRequest.findMany({
      include: { history: true },
      orderBy: { id: 'asc' },
    });
    return requests.map((request) => this.toResult(request));
  }

  /**
   * A department's work queue - the access pattern from data-model.md
   * ("department_id + status -> requests"). Either filter may be omitted.
   */
  async getQueue(department?: string, status?: string): Promise<RequestResult[]> {
    if (department !== undefined && !isDepartment(department)) {
      throw new BadRequestException(
        `"${department}" is not a valid department. Use one of: ${ALL_DEPARTMENTS.join(', ')}.`,
      );
    }
    if (status !== undefined && !isRequestStatus(status)) {
      throw new BadRequestException(`"${status}" is not a valid request status.`);
    }

    const requests = await this.prisma.serviceRequest.findMany({
      where: { department, currentStatus: status },
      include: { history: true },
      orderBy: { id: 'asc' },
    });
    return requests.map((request) => this.toResult(request));
  }

  /**
   * One request by id, with its full history, or null if there is none.
   *  - missing/unknown actor  -> 401 Unauthorized
   *  - actor may not view it  -> 403 Forbidden (an employee, on a request
   *    that is not theirs - see actors.ts's canViewHistory)
   */
  async getById(id: string, actorId: string | undefined): Promise<RequestResult | null> {
    const actor = this.requireActor(actorId);

    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: { history: true },
    });
    if (!request) return null;

    if (!canViewHistory(actor, request)) {
      throw new ForbiddenException(`${actor.displayName} may not view this request.`);
    }

    return this.toResult(request);
  }

  /**
   * Create a new request. It always starts in "SUBMITTED".
   * Anyone may submit, to any department - the invariant enforced here is
   * that the request itself is well-formed, not who is asking.
   */
  async create(
    title: unknown,
    description: unknown,
    department: unknown,
    actorId: string | undefined,
  ): Promise<RequestResult> {
    const actor = this.requireActor(actorId);
    if (!can(actor, 'request:submit')) {
      throw new ForbiddenException(`${actor.displayName} may not submit requests.`);
    }

    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new BadRequestException('A request needs a non-empty "title".');
    }
    if (typeof description !== 'string' || description.trim().length === 0) {
      throw new BadRequestException('A request needs a non-empty "description".');
    }
    if (!isDepartment(department)) {
      throw new BadRequestException(
        `"${String(department)}" is not a valid department. Use one of: ${ALL_DEPARTMENTS.join(', ')}.`,
      );
    }

    const now = new Date().toISOString();
    const record = await this.prisma.serviceRequest.create({
      data: {
        id: `REQ-${randomUUID().slice(0, 8)}`,
        title: title.trim(),
        description: description.trim(),
        department,
        currentStatus: RequestStatus.SUBMITTED,
        submittedBy: actor.id,
        lastUpdated: now,
        history: {
          create: { status: RequestStatus.SUBMITTED, occurredAt: now, actorId: actor.id },
        },
      },
      include: { history: true },
    });
    return this.toResult(record);
  }

  /**
   * Move a request to a new status, if both the actor and the lifecycle
   * allow it.
   *  - missing/unknown actor       -> 401 Unauthorized
   *  - unknown id                  -> 404 Not Found
   *  - not a real status           -> 400 Bad Request
   *  - actor not allowed to ask    -> 403 Forbidden (nothing is written)
   *  - illegal transition          -> 409 Conflict (terminal state or undefined transition)
   */
  async transition(id: string, to: unknown, actorId: string | undefined): Promise<RequestResult> {
    const actor = this.requireActor(actorId);

    const request = await this.prisma.serviceRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException(`Request "${id}" not found.`);
    }

    if (!isRequestStatus(to)) {
      throw new BadRequestException(`"${String(to)}" is not a valid request status.`);
    }

    this.authorizeTransition(actor, request.department, to);

    const check = checkTransition(request.currentStatus, to);
    if (!check.allowed) {
      if (check.reason === 'UNKNOWN_TARGET_STATUS') {
        throw new BadRequestException(check.message);
      }
      throw new ConflictException(check.message);
    }

    const now = new Date().toISOString();
    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        currentStatus: to,
        lastUpdated: now,
        history: { create: { status: to, occurredAt: now, actorId: actor.id } },
      },
      include: { history: true },
    });
    return this.toResult(updated);
  }

  private requireActor(actorId: string | undefined): Actor {
    const actor = resolveActor(actorId);
    if (!actor) {
      throw new UnauthorizedException('The hub does not know who is making this request.');
    }
    return actor;
  }

  /**
   * Who may even attempt this move, before asking whether the move itself
   * is legal (that question is requests.rules.ts's, not this one).
   *
   * Assigning or denying needs the lead-only gate; every other move (moving
   * a request through Assigned -> In Progress -> Completed) needs the
   * broader staff-or-lead "handle" gate. Both need the actor to belong to
   * the request's own department - the same identity is refused on a
   * neighbouring department's request.
   */
  private authorizeTransition(actor: Actor, department: Department, to: RequestStatus): void {
    const permission: Permission =
      to === RequestStatus.ASSIGNED
        ? 'request:assign'
        : to === RequestStatus.DENIED
          ? 'request:deny'
          : 'request:handle';

    if (!can(actor, permission) || !inSameDepartment(actor, department)) {
      throw new ForbiddenException(
        `${actor.displayName} may not move a ${department} request to "${to}".`,
      );
    }
  }
}

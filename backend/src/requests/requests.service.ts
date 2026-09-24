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
import { AiClassificationService } from '../ai-classification/ai-classification.service';
import { PrismaService } from '../prisma.service';
import { UsersService } from '../users/users.service';
import { Actor, Permission, can, canViewHistory, inSameDepartment } from './actors';
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
  aiVerified: boolean;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiClassification: AiClassificationService,
    private readonly users: UsersService,
  ) {}

  private toResult(record: RequestWithHistory): RequestResult {
    return {
      id: record.id,
      title: record.title,
      description: record.description,
      department: record.department,
      aiVerified: record.aiVerified,
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

  /**
   * Every request this actor may see: their own, plus - for staff/leads -
   * their whole department. This is the same rule canViewHistory already
   * uses per-request, applied here to the list instead of one id at a time,
   * so there is one definition of "may this actor see this request" rather
   * than two that could quietly drift apart.
   *
   * `view` narrows further into the filter tabs the UI offers on top of
   * that base scope:
   *  - "mine"   - just what this actor submitted themselves.
   *  - "handle" - department requests currently Assigned or In Progress
   *               (what `request:handle` lets staff/leads move forward).
   *  - "assign" - department requests currently Submitted (what
   *               `request:assign`/`request:deny` lets a lead act on).
   *  - omitted or "all" - the full base scope, no narrowing.
   * An employee has no department, so "handle"/"assign" are always empty
   * for them rather than an error.
   */
  async getVisible(actorId: string | undefined, view?: string): Promise<RequestResult[]> {
    const actor = await this.requireActor(actorId);

    const baseScope: Prisma.ServiceRequestWhereInput =
      actor.role === 'employee'
        ? { submittedBy: actor.id }
        : { OR: [{ submittedBy: actor.id }, { department: actor.department! }] };

    const narrower = this.viewFilter(actor, view);
    if (narrower === 'EMPTY') {
      return [];
    }

    const requests = await this.prisma.serviceRequest.findMany({
      where: narrower ? { AND: [baseScope, narrower] } : baseScope,
      include: { history: true },
      orderBy: { id: 'asc' },
    });
    return requests.map((request) => this.toResult(request));
  }

  private viewFilter(
    actor: Actor,
    view: string | undefined,
  ): Prisma.ServiceRequestWhereInput | 'EMPTY' | null {
    if (view === undefined || view === 'all') return null;
    if (view === 'mine') return { submittedBy: actor.id };

    if (view === 'handle') {
      if (!actor.department) return 'EMPTY';
      return {
        department: actor.department,
        currentStatus: { in: [RequestStatus.ASSIGNED, RequestStatus.IN_PROGRESS] },
      };
    }

    if (view === 'assign') {
      if (!actor.department) return 'EMPTY';
      return { department: actor.department, currentStatus: RequestStatus.SUBMITTED };
    }

    throw new BadRequestException(`"${view}" is not a valid view. Use one of: all, mine, handle, assign.`);
  }

  /**
   * One request by id, with its full history, or null if there is none.
   *  - missing/unknown actor  -> 401 Unauthorized
   *  - actor may not view it  -> 403 Forbidden (an employee, on a request
   *    that is not theirs - see actors.ts's canViewHistory)
   */
  async getById(id: string, actorId: string | undefined): Promise<RequestResult | null> {
    const actor = await this.requireActor(actorId);

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
    const actor = await this.requireActor(actorId);
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

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const { aiVerified } = await this.aiClassification.checkIntake({
      title: trimmedTitle,
      description: trimmedDescription,
      department,
      actor,
    });

    const now = new Date().toISOString();
    const record = await this.prisma.serviceRequest.create({
      data: {
        id: `REQ-${randomUUID().slice(0, 8)}`,
        title: trimmedTitle,
        description: trimmedDescription,
        department,
        aiVerified,
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
    const actor = await this.requireActor(actorId);

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

  private async requireActor(actorId: string | undefined): Promise<Actor> {
    const actor = await this.users.resolveActor(actorId);
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

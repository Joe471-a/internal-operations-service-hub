import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Actor } from '../requests/actors';
import { Department } from '../requests/requests.data';
import { ClassificationFailedError, GroqClassifierClient } from './groq-classifier.client';

export interface IntakeCheck {
  title: string;
  description: string;
  department: Department;
  actor: Actor;
}

/** "an IT request", "an HR request", "a FINANCE request" - fixed lookup, not a generic vowel guess. */
const ARTICLE_BY_DEPARTMENT: Record<Department, string> = {
  IT: 'an',
  HR: 'an',
  FINANCE: 'a',
};

/**
 * Internal Operations Service Hub — what the hub does with a classification,
 * not how it gets one.
 *
 * `GroqClassifierClient` only ever answers "what department does this text
 * look like." Whether that answer means anything - whether it should block
 * a submission - is a product decision, made here, not by the model. The
 * model never writes anything and never decides anything by itself; this
 * service is the one thing that does.
 */
@Injectable()
export class AiClassificationService {
  constructor(private readonly classifier: GroqClassifierClient) {}

  /**
   * Checks a request's free text against the department it is being filed
   * under, before it is ever written.
   *
   * Fails open: if the model cannot be reached, times out, or answers with
   * something the hub cannot use, neither rule runs and the submission is
   * allowed through unchecked - advisory infrastructure must never be the
   * reason a request cannot be filed at all. `aiVerified: false` is how
   * that "unchecked" state survives past this one call.
   */
  async checkIntake({ title, description, department, actor }: IntakeCheck): Promise<{ aiVerified: boolean }> {
    let classifiedDepartment: Department | null;
    try {
      const result = await this.classifier.classify(title, description);
      classifiedDepartment = result.department;
    } catch (problem) {
      if (problem instanceof ClassificationFailedError) {
        return { aiVerified: false };
      }
      throw problem;
    }

    // The model was consulted, and it honestly said "I cannot tell" - this
    // is not the same as the model being unreachable, so it does not fail
    // open. A request nobody can make sense of is a data-quality problem
    // the employee can fix by describing it, not something to wave through.
    if (classifiedDepartment === null) {
      throw new BadRequestException(
        'Please describe your request in enough detail for us to route it - we could not tell what department this belongs to.',
      );
    }

    // Rule A: the content has to actually belong to the department it is
    // being filed under - you cannot send an IT problem to HR.
    if (classifiedDepartment !== department) {
      throw new BadRequestException(
        `This looks like ${ARTICLE_BY_DEPARTMENT[classifiedDepartment]} ${classifiedDepartment} request, not ${department}. Please resubmit it to the right department.`,
      );
    }

    // Rule B: staff and leads do not file a formal request about their own
    // department's own domain - they are the ones who would resolve it.
    // Employees have no home department, so this can never apply to them.
    if ((actor.role === 'staff' || actor.role === 'lead') && actor.department === classifiedDepartment) {
      throw new ForbiddenException(
        `${actor.displayName} should resolve this directly rather than file a request to their own department.`,
      );
    }

    return { aiVerified: true };
  }
}

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { Actor } from '../requests/actors';
import { Department } from '../requests/requests.data';
import { AiClassificationService } from './ai-classification.service';
import { ClassificationFailedError, GroqClassifierClient } from './groq-classifier.client';

/**
 * The two rules, on their own.
 *
 * No network, no real Groq call - GroqClassifierClient is replaced with a
 * fake that returns whatever department the test wants, or fails on cue.
 * What is being checked here is what the hub *does* with a classification,
 * never how it gets one - that question belongs to
 * groq-classifier.client.test.ts instead.
 */

function fakeClassifier(outcome: { department: Department | null } | 'fail'): GroqClassifierClient {
  return {
    classify: async () => {
      if (outcome === 'fail') {
        throw new ClassificationFailedError('the model could not be reached');
      }
      return outcome;
    },
  } as unknown as GroqClassifierClient;
}

function buildService(outcome: { department: Department | null } | 'fail') {
  return new AiClassificationService(fakeClassifier(outcome));
}

const EMPLOYEE: Actor = {
  id: 'emp-001',
  displayName: 'Dana Karam (Employee)',
  role: 'employee',
  department: null,
  permissions: ['request:submit'],
};

const IT_STAFF: Actor = {
  id: 'it-staff-001',
  displayName: 'Yara Fakhoury (IT Staff)',
  role: 'staff',
  department: Department.IT,
  permissions: ['request:submit', 'request:handle'],
};

const IT_LEAD: Actor = {
  id: 'it-lead-001',
  displayName: 'Karim Rahal (IT Lead)',
  role: 'lead',
  department: Department.IT,
  permissions: ['request:submit', 'request:handle', 'request:assign', 'request:deny'],
};

const HR_LEAD: Actor = {
  id: 'hr-lead-001',
  displayName: 'Sami Nassar (HR Lead)',
  role: 'lead',
  department: Department.HR,
  permissions: ['request:submit', 'request:handle', 'request:assign', 'request:deny'],
};

describe('Rule A - content must match the declared department', () => {
  it('rejects when the classified department does not match what was declared', async () => {
    const service = buildService({ department: Department.HR });

    await expect(
      service.checkIntake({
        title: 'Reimbursement question',
        description: 'Per-diem policy for the conference.',
        department: Department.IT,
        actor: EMPLOYEE,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('names the department it actually looks like', async () => {
    const service = buildService({ department: Department.HR });

    await expect(
      service.checkIntake({
        title: 'x',
        description: 'y',
        department: Department.IT,
        actor: EMPLOYEE,
      }),
    ).rejects.toThrow(/HR/);
  });

  it('allows a request when the classified department matches what was declared', async () => {
    const service = buildService({ department: Department.IT });

    await expect(
      service.checkIntake({
        title: 'VPN keeps dropping',
        description: 'Disconnects every few minutes.',
        department: Department.IT,
        actor: EMPLOYEE,
      }),
    ).resolves.toEqual({ aiVerified: true });
  });
});

describe('Rule B - staff and leads may not file to their own department', () => {
  it('rejects IT staff filing an IT-matching request to IT', async () => {
    const service = buildService({ department: Department.IT });

    await expect(
      service.checkIntake({
        title: 'VPN keeps dropping',
        description: 'Disconnects every few minutes.',
        department: Department.IT,
        actor: IT_STAFF,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects the IT lead the same way', async () => {
    const service = buildService({ department: Department.IT });

    await expect(
      service.checkIntake({
        title: 'VPN keeps dropping',
        description: 'Disconnects every few minutes.',
        department: Department.IT,
        actor: IT_LEAD,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('never applies to an employee, who has no home department', async () => {
    const service = buildService({ department: Department.IT });

    await expect(
      service.checkIntake({
        title: 'VPN keeps dropping',
        description: 'Disconnects every few minutes.',
        department: Department.IT,
        actor: EMPLOYEE,
      }),
    ).resolves.toEqual({ aiVerified: true });
  });

  it('does not apply across departments - an HR lead filing an IT request is unaffected by Rule B', async () => {
    const service = buildService({ department: Department.IT });

    await expect(
      service.checkIntake({
        title: 'VPN keeps dropping',
        description: 'Disconnects every few minutes.',
        department: Department.IT,
        actor: HR_LEAD,
      }),
    ).resolves.toEqual({ aiVerified: true });
  });
});

describe('unclear input - an honest "I cannot tell" is rejected, not waved through', () => {
  it('rejects when the classifier cannot tell what department this belongs to', async () => {
    const service = buildService({ department: null });

    await expect(
      service.checkIntake({
        title: 'idk',
        description: 'idk',
        department: Department.IT,
        actor: EMPLOYEE,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not fail open for an unclear answer - this is a data problem, not an availability problem', async () => {
    const service = buildService({ department: null });

    await expect(
      service.checkIntake({
        title: 'idk',
        description: 'idk',
        department: Department.IT,
        actor: EMPLOYEE,
      }),
    ).rejects.toThrow(/enough detail/);
  });
});

describe('fail-open - the AI being unavailable never blocks a submission', () => {
  it('allows the request through, unverified, when the classifier fails', async () => {
    const service = buildService('fail');

    await expect(
      service.checkIntake({
        title: 'Whatever this is about',
        description: 'Something not classifiable right now.',
        department: Department.IT,
        actor: EMPLOYEE,
      }),
    ).resolves.toEqual({ aiVerified: false });
  });

  it('skips both rules when the classifier fails, even for a case that would otherwise be rejected', async () => {
    const service = buildService('fail');

    // Would be Rule B if the classifier had actually answered - but it never
    // gets the chance to, because the call itself failed first.
    await expect(
      service.checkIntake({
        title: 'VPN keeps dropping',
        description: 'Disconnects every few minutes.',
        department: Department.IT,
        actor: IT_STAFF,
      }),
    ).resolves.toEqual({ aiVerified: false });
  });
});

import { describe, expect, it } from 'vitest';
import { checkTransition } from './requests.rules';

/**
 * The Request lifecycle - on its own.
 *
 * No database, no NestJS, no actors. checkTransition is just a function, so
 * this asks it directly: given where a request is, and where someone wants
 * to move it, is that move legal? Who is allowed to ask is a different
 * question, answered in requests.service.test.ts.
 */

describe('valid transitions', () => {
  it('lets a request move through its full lifecycle, one step at a time', () => {
    expect(checkTransition('SUBMITTED', 'ASSIGNED')).toEqual({ allowed: true });
    expect(checkTransition('ASSIGNED', 'IN_PROGRESS')).toEqual({ allowed: true });
    expect(checkTransition('IN_PROGRESS', 'COMPLETED')).toEqual({ allowed: true });
  });

  it('lets a submitted request be denied instead of assigned', () => {
    expect(checkTransition('SUBMITTED', 'DENIED')).toEqual({ allowed: true });
  });
});

describe('the terminal-state invariant', () => {
  it('refuses to move a completed request anywhere', () => {
    const result = checkTransition('COMPLETED', 'IN_PROGRESS');
    expect(result).toMatchObject({ allowed: false, reason: 'TERMINAL_STATE' });
  });

  it('refuses to move a denied request anywhere', () => {
    const result = checkTransition('DENIED', 'ASSIGNED');
    expect(result).toMatchObject({ allowed: false, reason: 'TERMINAL_STATE' });
  });
});

describe('undefined transitions', () => {
  it('refuses to skip a step', () => {
    // SUBMITTED may become ASSIGNED or DENIED - never COMPLETED directly.
    const result = checkTransition('SUBMITTED', 'COMPLETED');
    expect(result).toMatchObject({ allowed: false, reason: 'UNDEFINED_TRANSITION' });
  });

  it('refuses to move backwards', () => {
    const result = checkTransition('IN_PROGRESS', 'ASSIGNED');
    expect(result).toMatchObject({ allowed: false, reason: 'UNDEFINED_TRANSITION' });
  });
});

describe('malformed input', () => {
  it('refuses a target that is not a real status', () => {
    const result = checkTransition('SUBMITTED', 'Banana');
    expect(result).toMatchObject({ allowed: false, reason: 'UNKNOWN_TARGET_STATUS' });
  });
});

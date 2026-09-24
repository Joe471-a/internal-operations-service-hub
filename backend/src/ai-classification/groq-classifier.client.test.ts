import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassificationFailedError, GroqClassifierClient, parseClassification } from './groq-classifier.client';

/**
 * Internal Operations Service Hub — the edge of what we control.
 *
 * Groq is somebody else's system, so these tests replace fetch itself.
 * Nothing is listening on a port and no real key is needed: the test decides
 * exactly what the provider says, including the answers a real model gives
 * on a bad day.
 *
 * What is being protected is not "we called an AI". It is that a model's
 * output is only ever accepted after the hub has checked it and rebuilt it
 * in the hub's own shape.
 */

/** A good answer the hub can use, before it is put in an envelope. */
const GOOD_CANDIDATE = { department: 'IT' };

/** The provider's envelope: the answer arrives as a *string*, not an object. */
function envelope(contentObject: unknown) {
  return {
    choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(contentObject) } }],
  };
}

/** Makes fetch answer with this status and this JSON body, and records the request. */
function modelAnswers(status: number, body: unknown) {
  const requests: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      return new Response(JSON.stringify(body), { status });
    }),
  );
  return requests;
}

/** Asks the model, with fetch already stubbed by the test. */
function askTheModel(title = "Laptop won't turn on", description = 'It will not power on at all.') {
  return new GroqClassifierClient().classify(title, description);
}

beforeEach(() => {
  // A real key is required with no fallback - tests supply a fake one so
  // "no key configured" can be its own, deliberate test case below.
  vi.stubEnv('GROQ_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('what the hub sends Groq', () => {
  it('sends the title and description as the user message', async () => {
    const requests = modelAnswers(200, envelope(GOOD_CANDIDATE));

    await askTheModel('VPN keeps dropping', 'Disconnects every few minutes since the update.');

    const sent = JSON.parse(String(requests[0].init.body));
    const userMessage = sent.messages.find((m: { role: string }) => m.role === 'user');
    const prompt = JSON.parse(userMessage.content);
    expect(prompt.title).toBe('VPN keeps dropping');
    expect(prompt.description).toBe('Disconnects every few minutes since the update.');
  });

  it("tells the model which departments exist, from the hub's own list", async () => {
    const requests = modelAnswers(200, envelope(GOOD_CANDIDATE));

    await askTheModel();

    const sent = JSON.parse(String(requests[0].init.body));
    const system = sent.messages.find((m: { role: string }) => m.role === 'system').content;
    expect(system).toContain('IT, HR, FINANCE');
  });

  it('sends the real API key as a bearer token, never as part of the body', async () => {
    const requests = modelAnswers(200, envelope(GOOD_CANDIDATE));

    await askTheModel();

    const headers = requests[0].init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer test-key');
    expect(String(requests[0].init.body)).not.toContain('test-key');
  });

  it('refuses before even calling out when no API key is configured', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(askTheModel()).rejects.toBeInstanceOf(ClassificationFailedError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('what the hub accepts back', () => {
  it('accepts each of the three real departments', async () => {
    for (const department of ['IT', 'HR', 'FINANCE'] as const) {
      modelAnswers(200, envelope({ department }));
      await expect(askTheModel()).resolves.toEqual({ department });
    }
  });

  it('accepts null as an honest "I cannot tell" - not every failure', async () => {
    modelAnswers(200, envelope({ department: null }));

    await expect(askTheModel()).resolves.toEqual({ department: null });
  });

  it('drops anything else the model added', async () => {
    modelAnswers(200, envelope({ department: 'IT', confidence: 0.97, reasoning: 'because it mentions a laptop' }));

    const result = await askTheModel();

    expect(Object.keys(result)).toEqual(['department']);
  });

  it('refuses a department the hub never defined', async () => {
    modelAnswers(200, envelope({ department: 'LEGAL' }));

    await expect(askTheModel()).rejects.toBeInstanceOf(ClassificationFailedError);
  });

  it('refuses a number where a department belongs', async () => {
    modelAnswers(200, envelope({ department: 42 }));

    await expect(askTheModel()).rejects.toBeInstanceOf(ClassificationFailedError);
  });

  it('refuses an answer with the department missing entirely', async () => {
    modelAnswers(200, envelope({}));

    await expect(askTheModel()).rejects.toBeInstanceOf(ClassificationFailedError);
  });
});

describe('when the envelope itself is wrong', () => {
  it('refuses when the model service is having a bad day', async () => {
    modelAnswers(503, { error: { message: 'model temporarily unavailable' } });

    await expect(askTheModel()).rejects.toBeInstanceOf(ClassificationFailedError);
  });

  it('refuses when the model cannot be reached at all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );

    await expect(askTheModel()).rejects.toBeInstanceOf(ClassificationFailedError);
  });

  it('refuses an envelope with no choices', async () => {
    modelAnswers(200, { id: 'chatcmpl-1', object: 'chat.completion' });

    await expect(askTheModel()).rejects.toBeInstanceOf(ClassificationFailedError);
  });

  it('refuses a choice with no message', async () => {
    modelAnswers(200, { choices: [{ index: 0, finish_reason: 'stop' }] });

    await expect(askTheModel()).rejects.toBeInstanceOf(ClassificationFailedError);
  });

  it('refuses content that is not a string', async () => {
    modelAnswers(200, { choices: [{ message: { content: GOOD_CANDIDATE } }] });

    await expect(askTheModel()).rejects.toBeInstanceOf(ClassificationFailedError);
  });

  it('refuses an answer that is not JSON at all', async () => {
    modelAnswers(200, {
      choices: [{ message: { content: 'Sure! This sounds like an IT problem to me.' } }],
    });

    await expect(askTheModel()).rejects.toBeInstanceOf(ClassificationFailedError);
  });
});

describe('parseClassification, directly', () => {
  it('is the same function the client uses internally - tests exercise the real thing', () => {
    expect(parseClassification({ department: 'HR' })).toEqual({ department: 'HR' });
  });

  it('refuses a non-object', () => {
    expect(() => parseClassification('IT')).toThrow(ClassificationFailedError);
  });

  it('refuses an array', () => {
    expect(() => parseClassification(['IT'])).toThrow(ClassificationFailedError);
  });

  it('refuses null as the whole answer', () => {
    expect(() => parseClassification(null)).toThrow(ClassificationFailedError);
  });

  it('accepts department: null specifically, as a real answer', () => {
    expect(parseClassification({ department: null })).toEqual({ department: null });
  });
});

import { Injectable } from '@nestjs/common';
import { ALL_DEPARTMENTS, isDepartment } from '../requests/requests.data';
import { ClassificationResult } from './classification.contract';

/**
 * Internal Operations Service Hub — the boundary to the real classifier.
 *
 * Groq is somebody else's system. It speaks its own language: `choices`,
 * `message`, `content`, and inside that content a blob of text it *claims*
 * is JSON. That language stops in this file - nothing outside
 * `ai-classification/` ever sees a `choices` array or a raw model string.
 *
 * `parseClassification` is exported on purpose: it is the one definition of
 * "an answer the hub can use," so tests exercise the exact function the
 * product runs, not a copy of it.
 */

/** Where the model lives, and which one - both overridable, neither guessed. */
const GROQ_BASE_URL = () => process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
const GROQ_MODEL = () => process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

/** No local fallback for a real provider's key - it is required or nothing runs. */
function requireApiKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new ClassificationFailedError('GROQ_API_KEY is not configured');
  }
  return key;
}

/** The model could not be reached, or answered something the hub cannot use. */
export class ClassificationFailedError extends Error {}

function systemPrompt(): string {
  return [
    'You are a request-routing assistant for an internal operations hub.',
    'You are given a JSON object with "title" and "description".',
    'Classify the request into exactly one department.',
    'Answer with a single JSON object and nothing else, with exactly this key:',
    `  department: one of ${ALL_DEPARTMENTS.join(', ')}, or null`,
    '',
    'Only answer with a real department when the title AND the description',
    'both genuinely support it - never route on the strength of just one of',
    'the two fields. Answer null when:',
    '  - the description does not actually explain the request (it is empty,',
    '    unrelated filler, or just repeats the title with no new detail),',
    '  - the title is a single vague or generic word or phrase and the',
    '    description does not add real, corroborating detail of its own,',
    '  - the title and the description point at different, unrelated things.',
    'A confident-looking word or phrase sitting alone in only one of the two',
    'fields is not enough on its own - route only what both fields together',
    'genuinely explain. This is different from a request that is merely',
    'ambiguous between two departments while still being well explained -',
    'in that case, pick the department that best fits rather than answering',
    'null.',
    'Use null only when you truly cannot tell - do not guess just to fill in',
    'a value.',
  ].join('\n');
}

/**
 * Turns whatever the model said into a department the hub already knows
 * about (or an honest "I cannot tell"), or throws.
 */
export function parseClassification(raw: unknown): ClassificationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ClassificationFailedError('the model did not return an object');
  }

  const candidate = raw as Record<string, unknown>;
  const department = candidate.department;

  // null is a real, allowed answer - the model saying "I cannot tell" is
  // not the same failure as the model saying something unusable.
  if (department === null) {
    return { department: null };
  }

  // Otherwise it has to be one the hub defined, not one the model invented.
  // A model cannot grow the product's vocabulary by writing a new word -
  // and any other keys it added are simply never read below.
  if (typeof department !== 'string' || !isDepartment(department)) {
    throw new ClassificationFailedError('the model returned a department the hub does not define');
  }

  return { department };
}

@Injectable()
export class GroqClassifierClient {
  /**
   * Asks the model what department this request text belongs to.
   *
   * The request is OpenAI-compatible, matching Groq's real API - nothing
   * about this shape is a local convenience.
   *
   * Returns the hub's own version of the answer, or throws. It never
   * returns a "maybe," so a caller cannot accidentally treat a bad answer
   * as a real classification.
   */
  async classify(title: string, description: string): Promise<ClassificationResult> {
    const apiKey = requireApiKey();

    const userContent = JSON.stringify({ title, description });

    let response: Response;
    try {
      response = await fetch(`${GROQ_BASE_URL()}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL(),
          // Same question, same answer - a feature that classifies a
          // request differently each time cannot be trusted, or tested.
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt() },
            { role: 'user', content: userContent },
          ],
        }),
        // A real network hop, unlike a local harness - it must not hang
        // the whole submission indefinitely.
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      // Unreachable, refused, timed out, dropped mid-flight: fetch
      // rejects, and that becomes the same hub failure as any other
      // provider problem.
      throw new ClassificationFailedError('the classification model could not be reached');
    }

    if (!response.ok) {
      throw new ClassificationFailedError(`the classification model answered with status ${response.status}`);
    }

    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!payload || typeof payload !== 'object') {
      throw new ClassificationFailedError('the classification model answer was not readable');
    }

    // From here down we are reading the provider's language, and
    // translating it. Every step assumes nothing.
    const choices = payload.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      throw new ClassificationFailedError('the classification model returned no choices');
    }

    const message = (choices[0] as Record<string, unknown> | null)?.message as
      | Record<string, unknown>
      | undefined;
    if (!message || typeof message !== 'object') {
      throw new ClassificationFailedError('the classification model returned no message');
    }

    // A provider does not hand back an object. It hands back a *string*
    // that it says is JSON - and sometimes it is prose instead.
    const content = message.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new ClassificationFailedError('the classification model returned no content');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new ClassificationFailedError('the classification model did not return JSON');
    }

    return parseClassification(parsed);
  }
}

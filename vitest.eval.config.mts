import { defineConfig } from 'vitest/config';

/**
 * Internal Operations Service Hub — how the AI evals run.
 *
 * A different question from `npm test`. That command asks "is the code
 * correct?" and runs against fakes, instantly, every time you save. This one
 * asks "does the real model still behave the way the product expects?" - it
 * makes real calls to Groq, needs a real GROQ_API_KEY (see backend/.env),
 * costs real (free-tier) requests, and is not a gate for commits - a model
 * can drift or Groq can change a default without any code being wrong.
 *
 * Kept as a separate config, separate command, separate file glob, so it
 * never runs by accident inside `npm test`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['evals/**/*.eval.ts'],
    setupFiles: ['./evals/setup.ts'],
    // One case at a time, on purpose - readable output, and no risk of
    // several live calls racing against the same free-tier rate limit.
    fileParallelism: false,
    // Real network calls to a real model take real time.
    testTimeout: 30000,
  },
});

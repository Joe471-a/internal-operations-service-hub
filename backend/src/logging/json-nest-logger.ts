import { LoggerService } from '@nestjs/common';
import { log } from './log';

/**
 * NestJS's own messages, in the same JSON format as everything else.
 *
 * The one that matters is the unexpected crash: when a request fails in a
 * way no rule anticipated (a 500), Nest reports the error and its stack
 * trace - where in the code it broke - through here. Nest's routine startup
 * chatter (modules loaded, routes mapped) is dropped: the backend writes its
 * own single startup line instead.
 */
export class JsonNestLogger implements LoggerService {
  log(..._ignored: unknown[]): void {}
  debug(..._ignored: unknown[]): void {}
  verbose(..._ignored: unknown[]): void {}

  warn(message: unknown, ...params: unknown[]): void {
    log('warn', 'nest', { context: contextFrom(params), message: text(message) });
  }

  error(message: unknown, ...params: unknown[]): void {
    this.write(message, params);
  }

  fatal(message: unknown, ...params: unknown[]): void {
    this.write(message, params);
  }

  private write(message: unknown, params: unknown[]): void {
    // Nest calls error(message, stack, context) - or error(message, context)
    // when there is no stack - so the stack is whichever extra argument
    // actually looks like one.
    const stack =
      (message instanceof Error ? message.stack : undefined) ??
      params.find((p): p is string => typeof p === 'string' && p.includes('\n    at '));
    log('error', 'nest', { context: contextFrom(params), message: text(message), stack });
  }
}

function text(message: unknown): string {
  return message instanceof Error ? message.message : String(message);
}

/** Nest passes the context (e.g. "ExceptionsHandler") as the last argument. */
function contextFrom(params: unknown[]): string | undefined {
  const last = params[params.length - 1];
  return typeof last === 'string' && !last.includes('\n') ? last : undefined;
}

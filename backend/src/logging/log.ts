/**
 * Internal Operations Service Hub — how the backend writes a log line.
 *
 * One JSON object per line: easy to scan, and searchable by field in
 * Render's Logs (e.g. "status":500 or "event":"ai_fail_open"). Render adds
 * its own timestamp too; `time` keeps local runs readable on their own.
 *
 * What never goes into a log: request bodies (they carry passwords at
 * login), the Authorization header (the session token), or a request's
 * title/description. Callers only pass the fields they mean to expose.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export type LogFields = Record<string, string | number | boolean | null | undefined>;

export function log(level: LogLevel, event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

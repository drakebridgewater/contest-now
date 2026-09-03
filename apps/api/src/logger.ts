import pino, { type Logger } from 'pino';

export type { Logger };

/**
 * Secrets that must never reach the logs. The admin password travels in the
 * x-admin-password header on every admin request, so without this it would be
 * written in plaintext on each one. Request headers are not logged at all in
 * the normal path (see the serializers in http/app.ts); this is the backstop
 * for anything else that logs a request or an error carrying headers.
 */
const redact = {
  paths: [
    'req.headers["x-admin-password"]',
    'req.headers.authorization',
    'req.headers.cookie',
    'headers["x-admin-password"]',
    'headers.authorization',
    'headers.cookie',
  ],
  censor: '[redacted]',
};

export function createLogger(level: string, pretty: boolean): Logger {
  if (pretty) {
    return pino({
      level,
      redact,
      transport: { target: 'pino-pretty', options: { colorize: true } },
    });
  }
  return pino({ level, redact });
}

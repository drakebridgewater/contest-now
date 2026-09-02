import pino, { type Logger } from 'pino';

export type { Logger };

export function createLogger(level: string, pretty: boolean): Logger {
  if (pretty) {
    return pino({ level, transport: { target: 'pino-pretty', options: { colorize: true } } });
  }
  return pino({ level });
}

import type { ZodType } from 'zod';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, message, details);
export const unauthorized = (message = 'Unauthorized') => new HttpError(401, message);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const conflict = (message: string, details?: unknown) =>
  new HttpError(409, message, details);
export const unsupportedMedia = (message: string) => new HttpError(415, message);

/** Parses with a Zod schema and turns failures into a 400 carrying the issues. */
export function parse<T>(schema: ZodType<T>, data: unknown, what = 'request'): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message,
    }));
    const first = issues[0];
    const summary = first
      ? `${first.path ? first.path + ': ' : ''}${first.message}`
      : `Invalid ${what}`;
    throw badRequest(summary, issues);
  }
  return result.data;
}

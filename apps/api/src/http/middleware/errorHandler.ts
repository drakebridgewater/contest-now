import type { ApiError } from '@contest/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from 'pino';
import { HttpError } from '../errors.ts';

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiError = { error: `No route for ${req.method} ${req.originalUrl}` };
  res.status(404).json(body);
};

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, _next) => {
    if (err instanceof HttpError) {
      const body: ApiError = { error: err.message, ...(err.details !== undefined ? { details: err.details } : {}) };
      res.status(err.status).json(body);
      return;
    }
    // multer size / field errors
    if (err && typeof err === 'object' && 'code' in err && err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'That photo is too large. Try a smaller one.' } satisfies ApiError);
      return;
    }
    if (err && typeof err === 'object' && 'type' in err && err.type === 'entity.too.large') {
      res.status(413).json({ error: 'Request too large.' } satisfies ApiError);
      return;
    }
    logger.error({ err, method: req.method, url: req.originalUrl }, 'Unhandled error');
    res.status(500).json({ error: 'Something went wrong on the server. Please try again.' } satisfies ApiError);
  };
}

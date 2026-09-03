import { createHash, timingSafeEqual } from 'node:crypto';
import { ADMIN_PASSWORD_HEADER } from '@contest/shared';
import type { RequestHandler } from 'express';
import { unauthorized } from '../errors.ts';

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/** Rejects requests whose X-Admin-Password header does not match the configured password. */
export function requireAdmin(adminPassword: string): RequestHandler {
  const expected = digest(adminPassword);
  return (req, _res, next) => {
    const header = req.get(ADMIN_PASSWORD_HEADER);
    if (typeof header !== 'string' || header.length === 0) {
      next(unauthorized('Admin password required'));
      return;
    }
    if (!timingSafeEqual(digest(header), expected)) {
      next(unauthorized('Wrong admin password'));
      return;
    }
    next();
  };
}

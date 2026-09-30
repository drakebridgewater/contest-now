import type { SessionScope } from '@contest/shared';
import type { Request, RequestHandler, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import type { Auth } from '../../auth.ts';
import { HttpError, unauthorized } from '../errors.ts';

export interface GuestIdentity {
  id: string;
  scope: SessionScope;
}

/**
 * Loads the guest's Better Auth session. A `vote` session (a name typed on the
 * tablet) can vote; a `full` one (magic link or invite) can also see and edit
 * the RSVP. The guest ends up in `res.locals.guest`; read it with `guestOf`.
 */
export function requireGuest(auth: Auth, needed: SessionScope): RequestHandler {
  return async (req, res, next) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session) {
        next(unauthorized('Sign in first'));
        return;
      }
      const scope = scopeOf(session.session);
      if (needed === 'full' && scope !== 'full') {
        next(new HttpError(403, 'Open the link from your email to see your RSVP'));
        return;
      }
      res.locals.guest = { id: session.user.id, scope } satisfies GuestIdentity;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** The request's session scope, or null when signed out. For routes open to everyone. */
export async function sessionScope(auth: Auth, req: Request): Promise<SessionScope | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  return session ? scopeOf(session.session) : null;
}

function scopeOf(session: { scope?: unknown }): SessionScope {
  return session.scope === 'vote' ? 'vote' : 'full';
}

export function guestOf(res: Response): GuestIdentity {
  return res.locals.guest as GuestIdentity;
}

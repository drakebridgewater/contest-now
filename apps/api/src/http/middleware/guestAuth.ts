import type { SessionScope } from '@contest/shared';
import type { RequestHandler, Response } from 'express';
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
      const scope: SessionScope = session.session.scope === 'vote' ? 'vote' : 'full';
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

export function guestOf(res: Response): GuestIdentity {
  return res.locals.guest as GuestIdentity;
}

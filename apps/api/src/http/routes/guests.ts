import { RequestLinkSchema, UpdateProfileSchema } from '@contest/shared';
import { fromNodeHeaders } from 'better-auth/node';
import { Router } from 'express';
import type { Auth } from '../../auth.ts';
import type { Db } from '../../db/client.ts';
import {
  ensureGuestForEmail,
  getGuest,
  getProfile,
  listGuestNames,
  rsvpSummary,
  toSessionGuest,
  updateProfile,
} from '../../services/guests.ts';
import { parse } from '../errors.ts';
import { guestOf, requireGuest } from '../middleware/guestAuth.ts';

/** Guest-facing routes outside Better Auth's own /api/auth. */
export function guestRoutes(db: Db, auth: Auth): Router {
  const router = Router();

  /** Who this device is signed in as, and how far that sign-in reaches. */
  router.get('/me', requireGuest(auth, 'vote'), async (_req, res) => {
    const { id, scope } = guestOf(res);
    res.json(toSessionGuest(await getGuest(db, id), scope));
  });

  router.get('/me/profile', requireGuest(auth, 'full'), async (_req, res) => {
    res.json(await getProfile(db, guestOf(res).id));
  });

  router.put('/me/profile', requireGuest(auth, 'full'), async (req, res) => {
    res.json(await updateProfile(db, guestOf(res).id, parse(UpdateProfileSchema, req.body)));
  });

  /**
   * Emails a sign-in link for the RSVP page. The guest is found or created here
   * so Better Auth's magic link only ever signs in; see ensureGuestForEmail.
   */
  router.post('/rsvp/request-link', async (req, res) => {
    const { email, name } = parse(RequestLinkSchema, req.body);
    const guest = await ensureGuestForEmail(db, email, name);
    await auth.api.signInMagicLink({
      body: {
        email: guest.email,
        callbackURL: '/event',
        errorCallbackURL: '/event',
        metadata: { name: guest.name },
      },
      headers: fromNodeHeaders(req.headers),
    });
    res.status(202).json({ sent: true });
  });

  router.get('/rsvp/summary', async (_req, res) => {
    res.json(await rsvpSummary(db));
  });

  /** Names only, for the submit form's autocomplete. Never emails. */
  router.get('/guests/names', async (_req, res) => {
    res.json(await listGuestNames(db));
  });

  return router;
}

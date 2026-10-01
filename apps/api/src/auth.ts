import {
  InviteSignInSchema,
  isPlaceholderEmail,
  VoteSignInSchema,
  type SessionScope,
} from '@contest/shared';
import { betterAuth, type BetterAuthPlugin } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthEndpoint, formCsrfMiddleware } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import { magicLink } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import type { AppConfig } from './config.ts';
import type { Db } from './db/client.ts';
import { authAccounts, authVerifications, guests, guestSessions } from './db/schema.ts';
import { linkEmail, type Mailer } from './services/mailer.ts';
import { findOrCreateGuestByName, hashToken, mayReceiveSignInLink } from './services/guests.ts';

export const AUTH_BASE_PATH = '/api/auth';
/** A sign-in link from the RSVP page: short, it is used right away. */
const MAGIC_LINK_SECONDS = 15 * 60;

type AuthConfig = Pick<AppConfig, 'authSecret' | 'publicUrl' | 'nodeEnv'>;

/**
 * Guests sign in three ways. Better Auth's magic link covers the RSVP page; the
 * two endpoints below cover what it has no notion of: a name typed on the
 * shared voting tablet, and a long-lived invite link sent by the host.
 */
function guestPlugin(db: Db) {
  return {
    id: 'contest-guest',
    endpoints: {
      guestVoteSignIn: createAuthEndpoint(
        '/guest/vote',
        // The same cross-site checks Better Auth puts on its own sign-in endpoints.
        { method: 'POST', body: VoteSignInSchema, use: [formCsrfMiddleware] },
        async (ctx) => {
          const guest = await findOrCreateGuestByName(db, ctx.body.name);
          return startSession(ctx, guest.id, 'vote');
        },
      ),
      guestInviteSignIn: createAuthEndpoint(
        '/guest/invite',
        { method: 'POST', body: InviteSignInSchema, use: [formCsrfMiddleware] },
        async (ctx) => {
          const guest = await db
            .select({
              id: guests.id,
              inviteOpenedAt: guests.inviteOpenedAt,
              access: guests.access,
            })
            .from(guests)
            .where(eq(guests.inviteTokenHash, hashToken(ctx.body.token)))
            .then((rows) => rows[0]);
          // Declining a guest clears their link too; the access check is a backstop.
          if (!guest || guest.access !== 'invited') {
            throw new APIError('UNAUTHORIZED', {
              message: 'This invite link is no longer valid. Ask the host for a new one.',
            });
          }
          if (!guest.inviteOpenedAt) {
            await db
              .update(guests)
              .set({ inviteOpenedAt: new Date() })
              .where(eq(guests.id, guest.id));
          }
          return startSession(ctx, guest.id, 'full');
        },
      ),
    },
    rateLimit: [
      {
        pathMatcher: (path: string) => path.startsWith('/guest/'),
        window: 60,
        max: 30,
      },
    ],
  } satisfies BetterAuthPlugin;
}

// The endpoint context type is deep inside better-call's generics; only these
// members are used, so they are all this helper asks for.
type SessionContext = Parameters<typeof setSessionCookie>[0];

async function startSession(ctx: SessionContext, guestId: string, scope: SessionScope) {
  const user = await ctx.context.internalAdapter.findUserById(guestId);
  if (!user) throw new APIError('NOT_FOUND', { message: 'Guest not found' });
  // `overrideAll`: without it the field's default ('full') is applied after the
  // override, and every tablet sign-in would quietly get the RSVP too.
  const session = await ctx.context.internalAdapter.createSession(guestId, false, { scope }, true);
  if (!session) throw new APIError('INTERNAL_SERVER_ERROR', { message: 'Could not sign in' });
  await setSessionCookie(ctx, { session, user });
  return ctx.json({ guestId, scope });
}

/**
 * The request's Origin when it names the host the request was sent to, i.e. the
 * page is on the same server. The party tablet may open the app by IP while
 * PUBLIC_URL names the server, and nginx forwards Host without the port, so the
 * hostnames are compared. A page on another site never matches.
 */
function sameHostOrigin(request: Request | undefined): string[] {
  const origin = request?.headers.get('origin');
  const host = request?.headers.get('host');
  if (!origin || !host) return [];
  try {
    const originHost = new URL(origin).hostname;
    const requestHost = new URL(`http://${host}`).hostname;
    return originHost === requestHost ? [origin] : [];
  } catch {
    return [];
  }
}

export function createAuth(db: Db, config: AuthConfig, mailer: Mailer) {
  return betterAuth({
    appName: 'Contest',
    baseURL: config.publicUrl,
    basePath: AUTH_BASE_PATH,
    secret: config.authSecret,
    trustedOrigins: (request) => [config.publicUrl, ...sameHostOrigin(request)],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { guests, guestSessions, authAccounts, authVerifications },
    }),
    user: {
      modelName: 'guests',
      // Guests are only ever created by services/guests.ts, which sets this; it is
      // declared so Better Auth knows the column is not its problem.
      additionalFields: { nameKey: { type: 'string', required: true, input: false } },
    },
    session: {
      modelName: 'guestSessions',
      // A party runs one evening, but RSVPs start weeks ahead.
      expiresIn: 60 * 60 * 24 * 60,
      updateAge: 60 * 60 * 24,
      additionalFields: {
        scope: { type: 'string', required: false, defaultValue: 'full', input: false },
      },
    },
    account: { modelName: 'authAccounts' },
    verification: { modelName: 'authVerifications' },
    emailAndPassword: { enabled: false },
    // Better Auth turns origin checks off under test runners; keep them on so the
    // tests exercise what production does.
    advanced: { cookiePrefix: 'contest', disableOriginCheck: false },
    rateLimit: { enabled: config.nodeEnv === 'production' },
    telemetry: { enabled: false },
    plugins: [
      magicLink({
        expiresIn: MAGIC_LINK_SECONDS,
        // Guests are created by the RSVP route or the host, never by the link itself.
        disableSignUp: true,
        storeToken: 'hashed',
        sendMagicLink: async ({ email, url, metadata }) => {
          if (isPlaceholderEmail(email)) return;
          // Better Auth's own /sign-in/magic-link endpoint is public too, so the
          // guest list is enforced here, not only on the RSVP route.
          if (!(await mayReceiveSignInLink(db, email))) return;
          const name = typeof metadata?.name === 'string' ? metadata.name : '';
          await mailer.send(
            linkEmail({
              to: email,
              subject: 'Your sign-in link',
              greeting: name ? `Hi ${name},` : 'Hi,',
              body: 'Tap the button to open your RSVP. The link works once and expires in 15 minutes.',
              buttonLabel: 'Open my RSVP',
              url,
              footer: 'If you did not ask for this, you can ignore this email.',
            }),
          );
        },
      }),
      guestPlugin(db),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

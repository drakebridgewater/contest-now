import {
  EMAIL_MERGE_TAGS,
  isPlaceholderEmail,
  type CustomEmail,
  type CustomEmailPreview,
  type EmailMergeTag,
  type EventSettings,
  type SendInvitesResult,
} from '@contest/shared';
import { eq, inArray } from 'drizzle-orm';
import { convert } from 'html-to-text';
import { Liquid, type FS, type Template } from 'liquidjs';
import sanitizeHtml from 'sanitize-html';
import type { Db } from '../db/client.ts';
import { guests } from '../db/schema.ts';
import { badRequest } from '../http/errors.ts';
import { createInviteLink, inviteUrl } from './guests.ts';
import { emailShell, type MailMessage, type Mailer } from './mailer.ts';

/**
 * Templates are written by the host, so `include` and `render` get a file system
 * with nothing in it rather than the server's disk.
 */
const noFiles: FS = {
  exists: async () => false,
  existsSync: () => false,
  readFile: async () => {
    throw new Error('Templates cannot load files');
  },
  readFileSync: () => {
    throw new Error('Templates cannot load files');
  },
  resolve: (_dir, file) => file,
};

/** And the tags that would reach for it are refused outright, so the host hears why. */
const FILE_TAGS = ['include', 'render', 'layout'];

const limits = {
  fs: noFiles,
  relativeReference: false,
  strictVariables: true,
  strictFilters: true,
  ownPropertyOnly: true,
  parseLimit: 100_000,
  renderLimit: 1_000,
  memoryLimit: 10_000_000,
};

/** The body is HTML, so every `{{ }}` output is escaped: a guest named `<b>` stays text. */
const htmlEngine = new Liquid({ ...limits, outputEscape: 'escape' });
/** The subject is a plain header. */
const textEngine = new Liquid(limits);
for (const engine of [htmlEngine, textEngine]) {
  for (const tag of FILE_TAGS) {
    engine.registerTag(tag, {
      parse() {
        throw new Error(`{% ${tag} %} is not available in emails`);
      },
      render() {},
    });
  }
}

const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'a',
    'ul',
    'ol',
    'li',
    'h2',
    'h3',
    'blockquote',
    'hr',
  ],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener' }),
  },
};

type MergeValues = Record<EmailMergeTag, string>;

interface Parsed {
  subject: Template[];
  html: Template[];
  usesRsvpLink: boolean;
}

function parseTemplate(input: CustomEmailPreview, settings: EventSettings): Parsed {
  let subject: Template[];
  let html: Template[];
  try {
    subject = textEngine.parse(input.subject);
    html = htmlEngine.parse(input.html);
  } catch (error) {
    throw badRequest(
      `The email has a broken merge tag: ${error instanceof Error ? error.message : 'could not read it'}`,
    );
  }
  const used = new Set([
    ...textEngine.globalVariablesSync(subject),
    ...htmlEngine.globalVariablesSync(html),
  ]);
  const unknown = [...used].filter((name) => !(name in EMAIL_MERGE_TAGS));
  if (unknown.length > 0) {
    throw badRequest(
      `Unknown merge tag ${unknown.map((name) => `{{ ${name} }}`).join(', ')}. Use ${Object.keys(
        EMAIL_MERGE_TAGS,
      )
        .map((name) => `{{ ${name} }}`)
        .join(', ')}.`,
    );
  }
  if (used.has('photo_album_link') && settings.photoShareUrl === '') {
    throw badRequest('Add a photo album link under Setup before using {{ photo_album_link }}.');
  }
  return { subject, html, usesRsvpLink: used.has('rsvp_link') };
}

async function render(parsed: Parsed, to: string, values: MergeValues): Promise<MailMessage> {
  const subject = (await textEngine.render(parsed.subject, values)).replace(/\s+/g, ' ').trim();
  const body = sanitizeHtml(await htmlEngine.render(parsed.html, values), SANITIZE);
  const text = convert(body, {
    wordwrap: 100,
    // No brackets around hrefs, so a pasted link never picks up a stray "]".
    selectors: [
      { selector: 'a', options: { linkBrackets: false, hideLinkHrefIfSameAsText: true } },
    ],
  });
  return { to, subject, text: `${text}\n`, html: emailShell(body) };
}

/** Renders the email for a made-up guest. Never touches anyone's invite link. */
export async function previewCustomEmail(
  input: CustomEmailPreview,
  settings: EventSettings,
  publicUrl: string,
): Promise<{ subject: string; html: string }> {
  const parsed = parseTemplate(input, settings);
  const message = await render(parsed, '', {
    guest_name: 'Sam Sample',
    rsvp_link: inviteUrl(publicUrl, 'preview'),
    photo_album_link: settings.photoShareUrl,
  });
  return { subject: message.subject, html: message.html };
}

/**
 * Sends the host's own email to each chosen guest. A personal RSVP link is only
 * made when the email uses one, since making it revokes the guest's previous link.
 */
export async function sendCustomEmail(
  db: Db,
  mailer: Mailer,
  publicUrl: string,
  settings: EventSettings,
  input: CustomEmail,
): Promise<SendInvitesResult> {
  const parsed = parseTemplate(input, settings);
  const rows = await db.select().from(guests).where(inArray(guests.id, input.guestIds));
  const result: SendInvitesResult = { sent: 0, skipped: 0, failed: [] };
  for (const row of rows) {
    if (isPlaceholderEmail(row.email)) {
      result.skipped += 1;
      continue;
    }
    try {
      const rsvpLink = parsed.usesRsvpLink
        ? (await createInviteLink(db, publicUrl, row.id)).url
        : '';
      await mailer.send(
        await render(parsed, row.email, {
          guest_name: row.name,
          rsvp_link: rsvpLink,
          photo_album_link: settings.photoShareUrl,
        }),
      );
      if (parsed.usesRsvpLink) {
        await db.update(guests).set({ inviteSentAt: new Date() }).where(eq(guests.id, row.id));
      }
      result.sent += 1;
    } catch (error) {
      result.failed.push({
        name: row.name,
        error: error instanceof Error ? error.message : 'Could not send',
      });
    }
  }
  return result;
}

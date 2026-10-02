import nodemailer from 'nodemailer';
import type { SmtpConfig } from '../config.ts';
import type { Logger } from '../logger.ts';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  /** False when no SMTP server is configured; messages are then only logged. */
  readonly configured: boolean;
  send(message: MailMessage): Promise<void>;
}

/**
 * SMTP through nodemailer, so any provider works: Gmail or Fastmail with an app
 * password, Postmark, SES, or a relay of your own. Without SMTP_HOST it logs each
 * message instead, which is how links are followed in development.
 */
export function createMailer(smtp: SmtpConfig | null, logger: Logger): Mailer {
  if (!smtp) {
    return {
      configured: false,
      send: async (message) => {
        logger.warn(
          { to: message.to, subject: message.subject, text: message.text },
          'SMTP is not configured; this email was not sent',
        );
      },
    };
  }
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    // nodemailer waits up to two minutes to connect by default, far longer than a
    // reverse proxy waits for the response: the guest gets a 504 and no clue why.
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS * 2,
  });
  const target = { host: smtp.host, port: smtp.port, secure: smtp.secure };
  const mismatch = tlsMismatch(smtp);
  if (mismatch) logger.warn(target, mismatch);
  // Checked once at startup so a bad SMTP setting shows in the log before a guest finds it.
  transport.verify().then(
    () => logger.info(target, 'SMTP connection verified'),
    (error: unknown) =>
      logger.error({ ...target, err: error }, 'SMTP check failed; emails will not send'),
  );
  return {
    configured: true,
    send: async (message) => {
      try {
        await transport.sendMail({ from: smtp.from, ...message });
      } catch (error) {
        logger.error({ ...target, to: message.to, err: error }, 'Could not send email');
        throw error;
      }
    },
  };
}

const SMTP_TIMEOUT_MS = 10_000;

/** The usual way an SMTP setup hangs instead of failing: TLS mode and port disagree. */
function tlsMismatch(smtp: SmtpConfig): string | null {
  if (smtp.port === 465 && !smtp.secure) {
    return 'SMTP_PORT is 465 but SMTP_SECURE is false; port 465 expects SMTP_SECURE=true';
  }
  if ((smtp.port === 587 || smtp.port === 25) && smtp.secure) {
    return `SMTP_PORT is ${smtp.port} but SMTP_SECURE is true; that port expects SMTP_SECURE=false (STARTTLS)`;
  }
  return null;
}

/** Keeps every message in memory. Tests read links back out of `sent`. */
export function createMemoryMailer(): Mailer & { sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return {
    configured: true,
    sent,
    send: async (message) => {
      sent.push(message);
    },
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const BUTTON_STYLE =
  'background:#b91c1c;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600';

/** The page every email is wrapped in. `inner` must already be safe HTML. */
export function emailShell(inner: string): string {
  return `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.5;color:#1f2937;max-width:32rem;margin:0 auto;padding:24px">
${inner}
</body></html>`;
}

/** One short email with one button. Plain text first: some guests read mail that way. */
export function linkEmail(options: {
  to: string;
  subject: string;
  greeting: string;
  body: string;
  buttonLabel: string;
  url: string;
  footer: string;
}): MailMessage {
  const { to, subject, greeting, body, buttonLabel, url, footer } = options;
  const text = `${greeting}\n\n${body}\n\n${buttonLabel}: ${url}\n\n${footer}\n`;
  const html = emailShell(`<p>${escapeHtml(greeting)}</p>
<p>${escapeHtml(body)}</p>
<p style="margin:28px 0"><a href="${escapeHtml(url)}" style="${BUTTON_STYLE}">${escapeHtml(buttonLabel)}</a></p>
<p style="font-size:13px;color:#6b7280">Or paste this link into your browser:<br>${escapeHtml(url)}</p>
<p style="font-size:13px;color:#6b7280">${escapeHtml(footer)}</p>`);
  return { to, subject, text, html };
}

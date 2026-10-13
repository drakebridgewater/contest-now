import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.ts';

const BASE = { DATABASE_URL: 'postgres://u:p@localhost:5432/db', ADMIN_PASSWORD: 'secret' };

describe('mail config', () => {
  it('sends replies to MAIL_REPLY_TO when set', () => {
    const config = loadConfig({
      ...BASE,
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_USER: 'party@gmail.com',
      MAIL_REPLY_TO: 'Party <party@fastmail.com>',
    });
    expect(config.smtp).toMatchObject({
      from: 'party@gmail.com',
      replyTo: 'Party <party@fastmail.com>',
    });
  });

  it('leaves replies on the sending address by default', () => {
    const config = loadConfig({
      ...BASE,
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_USER: 'party@gmail.com',
    });
    expect(config.smtp?.replyTo).toBe('');
  });
});

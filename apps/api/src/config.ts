import path from 'node:path';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (postgres://user:pass@host:5432/db)'),
  ADMIN_PASSWORD: z.string().min(4, 'ADMIN_PASSWORD is required and must be at least 4 characters'),
  UPLOADS_DIR: z.string().default('./uploads'),
  /** Public path prefix photos are served from (through the web proxy). */
  UPLOADS_PUBLIC_PATH: z.string().default('/uploads'),
  MIGRATIONS_DIR: z.string().default('./drizzle'),
  CORS_ORIGIN: z.string().default('*'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY: z.coerce.boolean().default(true),
  /** Signs guest session cookies. Required in production. */
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters')
    .optional(),
  /** Where guests open the app; sign-in and invite links point here. */
  PUBLIC_URL: z.url().default('http://localhost:5173'),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  /** true = TLS from the first byte (port 465); false = STARTTLS. */
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  MAIL_FROM: z.string().default(''),
});

const DEV_AUTH_SECRET = 'development-only-secret-do-not-use-in-production';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  host: string;
  databaseUrl: string;
  adminPassword: string;
  uploadsDir: string;
  uploadsPublicPath: string;
  migrationsDir: string;
  corsOrigin: string;
  logLevel: z.infer<typeof EnvSchema>['LOG_LEVEL'];
  trustProxy: boolean;
  authSecret: string;
  publicUrl: string;
  /** Null when SMTP_HOST is unset: links are logged instead of mailed. */
  smtp: SmtpConfig | null;
}

/** Parses process.env (or a given object) into a typed config; throws a readable error when invalid. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `  ${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid configuration:\n${problems.join('\n')}`);
  }
  const e = parsed.data;
  if (!e.BETTER_AUTH_SECRET && e.NODE_ENV === 'production') {
    throw new Error(
      'Invalid configuration:\n  BETTER_AUTH_SECRET: required in production (any random string of 32+ characters, e.g. `openssl rand -hex 32`)',
    );
  }
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    host: e.HOST,
    databaseUrl: e.DATABASE_URL,
    adminPassword: e.ADMIN_PASSWORD,
    uploadsDir: path.resolve(e.UPLOADS_DIR),
    uploadsPublicPath: e.UPLOADS_PUBLIC_PATH.replace(/\/+$/, ''),
    migrationsDir: path.resolve(e.MIGRATIONS_DIR),
    corsOrigin: e.CORS_ORIGIN,
    logLevel: e.LOG_LEVEL,
    trustProxy: e.TRUST_PROXY,
    authSecret: e.BETTER_AUTH_SECRET ?? DEV_AUTH_SECRET,
    publicUrl: e.PUBLIC_URL.replace(/\/+$/, ''),
    smtp: e.SMTP_HOST
      ? {
          host: e.SMTP_HOST,
          port: e.SMTP_PORT,
          secure: e.SMTP_SECURE,
          user: e.SMTP_USER,
          pass: e.SMTP_PASS,
          from: e.MAIL_FROM || e.SMTP_USER,
        }
      : null,
  };
}

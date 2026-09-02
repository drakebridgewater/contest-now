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
});

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
  };
}

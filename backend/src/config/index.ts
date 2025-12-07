import dotenv from 'dotenv';
import path from 'node:path';
import { AppConfig } from '@/types';

dotenv.config();

const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Environment variable ${key} is required`);
    }
    return defaultValue;
  }
  return value;
};

const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new TypeError(`Environment variable ${key} must be a number`);
  }
  return parsed;
};

export const config: AppConfig = {
  server: {
    port: getEnvNumber('PORT', 3001),
    host: getEnv('HOST', '0.0.0.0'),
    nodeEnv: getEnv('NODE_ENV', 'development'),
    corsOrigin: getEnv('CORS_ORIGIN', '*'),
    uploadsDir: process.env.NODE_ENV === 'production'
      ? '/app/uploads'
      : path.join(__dirname, '../../uploads'),
    maxFileSize: getEnvNumber('MAX_FILE_SIZE', 10 * 1024 * 1024), // 10MB
    baseUrl: getEnv('BASE_URL', `http://localhost:${getEnvNumber('PORT', 3001)}`),
  },
  database: {
    path: getEnv('DATABASE_PATH', process.env.NODE_ENV === 'production'
      ? '/app/data/contest.db'
      : path.join(__dirname, '../../data/contest.db')),
  },
};

export default config;

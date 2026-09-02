/** Header carrying the admin password on admin routes. */
export const ADMIN_PASSWORD_HEADER = 'x-admin-password';

/** Shape of every non-2xx JSON response from the API. */
export interface ApiError {
  error: string;
  /** Zod issues or other structured detail, when available. */
  details?: unknown;
}

export interface HealthStatus {
  status: 'ok' | 'starting' | 'error';
  db: 'ready' | 'migrating' | 'unavailable';
  version: string;
}

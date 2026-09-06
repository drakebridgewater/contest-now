/** Header carrying the admin password on admin routes. */
export const ADMIN_PASSWORD_HEADER = 'x-admin-password';

/** Shape of every non-2xx JSON response from the API. */
export interface ApiError {
  error: string;
  /** Zod issues or other structured detail, when available. */
  details?: unknown;
}

export interface HealthStatus {
  /** `degraded` means the app is serving but something is broken; see the fields. */
  status: 'ok' | 'starting' | 'degraded' | 'error';
  db: 'ready' | 'migrating' | 'unavailable';
  /**
   * Whether photos can be written to disk. Almost always a deployment problem
   * rather than a code one: the uploads directory is a mounted volume, and the
   * mount's ownership on the host wins over anything the image sets.
   */
  uploads: 'ready' | 'unwritable';
  version: string;
}

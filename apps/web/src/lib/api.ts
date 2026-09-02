import {
  ADMIN_PASSWORD_HEADER,
  type ApiError,
  type Award,
  type AwardInput,
  type Category,
  type CategoryInput,
  type ContestConfig,
  type ContestResults,
  type Criterion,
  type CriterionInput,
  type Entry,
  type EventSettings,
  type SettingsInput,
  type UpsertVote,
  type VoterInfo,
  type VoterState,
  type VoterVote,
} from '@contest/shared';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

const ADMIN_STORAGE_KEY = 'contest.adminPassword';

export function getAdminPassword(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminPassword(password: string | null): void {
  try {
    if (password === null) sessionStorage.removeItem(ADMIN_STORAGE_KEY);
    else sessionStorage.setItem(ADMIN_STORAGE_KEY, password);
  } catch {
    // Private browsing: the password simply does not persist across reloads.
  }
}

/** An API response that was not 2xx. `status` lets callers treat 401/409 specially. */
export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  admin?: boolean;
  /** Overrides `body` for multipart uploads. */
  formData?: FormData;
  password?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, admin = false, formData, password } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (admin) {
    const secret = password ?? getAdminPassword();
    if (secret) headers[ADMIN_PASSWORD_HEADER] = secret;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
  } catch {
    throw new ApiRequestError(
      0,
      'Could not reach the server. Check your connection and try again.',
    );
  }

  if (response.status === 401 && admin) setAdminPassword(null);

  if (!response.ok) {
    let payload: ApiError = { error: `Request failed (${response.status})` };
    try {
      payload = (await response.json()) as ApiError;
    } catch {
      // keep the default message
    }
    throw new ApiRequestError(response.status, payload.error, payload.details);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  getContest: () => request<ContestConfig>('/contest'),
  getEntries: () => request<Entry[]>('/entries'),

  createEntry: (form: FormData) => request<Entry>('/entries', { method: 'POST', formData: form }),

  getVoterState: (voterName: string) =>
    request<VoterState>(`/voters/${encodeURIComponent(voterName)}`),

  saveVote: (entryId: number, input: UpsertVote) =>
    request<VoterVote>(`/votes/${entryId}`, { method: 'PUT', body: input }),

  saveBallot: (awardId: string, voterName: string, entryId: number) =>
    request<{ awardId: string; entryId: number }>(`/award-ballots/${encodeURIComponent(awardId)}`, {
      method: 'PUT',
      body: { voterName, entryId },
    }),

  clearBallot: (awardId: string, voterName: string) =>
    request<void>(
      `/award-ballots/${encodeURIComponent(awardId)}/${encodeURIComponent(voterName)}`,
      { method: 'DELETE' },
    ),

  // --- admin ---
  adminLogin: (password: string) =>
    request<void>('/admin/login', { method: 'POST', admin: true, password }),
  adminConfig: () => request<ContestConfig>('/admin/config', { admin: true }),
  adminResults: () => request<ContestResults>('/admin/results', { admin: true }),
  adminVoters: () => request<VoterInfo[]>('/admin/voters', { admin: true }),

  updateSettings: (input: SettingsInput) =>
    request<EventSettings>('/admin/settings', { method: 'PUT', body: input, admin: true }),

  createCategory: (input: CategoryInput) =>
    request<Category>('/admin/categories', { method: 'POST', body: input, admin: true }),
  updateCategory: (id: string, input: CategoryInput) =>
    request<Category>(`/admin/categories/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: input,
      admin: true,
    }),
  deleteCategory: (id: string) =>
    request<void>(`/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE', admin: true }),

  createCriterion: (input: CriterionInput) =>
    request<Criterion>('/admin/criteria', { method: 'POST', body: input, admin: true }),
  updateCriterion: (id: number, input: Partial<CriterionInput>) =>
    request<Criterion>(`/admin/criteria/${id}`, { method: 'PUT', body: input, admin: true }),
  deleteCriterion: (id: number) =>
    request<void>(`/admin/criteria/${id}`, { method: 'DELETE', admin: true }),

  createAward: (input: AwardInput) =>
    request<Award>('/admin/awards', { method: 'POST', body: input, admin: true }),
  updateAward: (id: string, input: AwardInput) =>
    request<Award>(`/admin/awards/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: input,
      admin: true,
    }),
  deleteAward: (id: string) =>
    request<void>(`/admin/awards/${encodeURIComponent(id)}`, { method: 'DELETE', admin: true }),

  deleteEntry: (id: number) =>
    request<void>(`/admin/entries/${id}`, { method: 'DELETE', admin: true }),

  renameVoter: (voterName: string, newName: string) =>
    request<{ votes: number; ballots: number }>(`/admin/voters/${encodeURIComponent(voterName)}`, {
      method: 'PUT',
      body: { newName },
      admin: true,
    }),
  deleteVoter: (voterName: string) =>
    request<{ votes: number; ballots: number }>(`/admin/voters/${encodeURIComponent(voterName)}`, {
      method: 'DELETE',
      admin: true,
    }),
};

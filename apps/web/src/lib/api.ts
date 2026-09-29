import {
  ADMIN_PASSWORD_HEADER,
  type AddGuestsResult,
  type AdminGuest,
  type ApiError,
  type Award,
  type AwardInput,
  type Category,
  type CategoryInput,
  type ContestConfig,
  type ContestResults,
  type Criterion,
  type CriterionInput,
  type CustomEmail,
  type CustomEmailPreview,
  type Entry,
  type EventSettings,
  type GuestName,
  type GuestProfile,
  type NewGuest,
  type RsvpSummary,
  type SendInvites,
  type SendInvitesResult,
  type SessionGuest,
  type SettingsInput,
  type UpdateProfile,
  type UpsertVote,
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
      // The guest session is an httpOnly cookie set by the API's auth routes.
      credentials: 'same-origin',
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

  // --- guest session ---
  /** The signed-in guest, or null when this device is signed out. */
  me: async (): Promise<SessionGuest | null> => {
    try {
      return await request<SessionGuest>('/me');
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) return null;
      throw error;
    }
  },
  voteSignIn: (name: string) =>
    request<{ guestId: string }>('/auth/guest/vote', { method: 'POST', body: { name } }),
  inviteSignIn: (token: string) =>
    request<{ guestId: string }>('/auth/guest/invite', { method: 'POST', body: { token } }),
  requestLink: (email: string, name?: string) =>
    request<{ sent: true }>('/rsvp/request-link', {
      method: 'POST',
      body: name ? { email, name } : { email },
    }),
  signOut: () => request<unknown>('/auth/sign-out', { method: 'POST', body: {} }),

  getProfile: () => request<GuestProfile>('/me/profile'),
  updateProfile: (input: UpdateProfile) =>
    request<GuestProfile>('/me/profile', { method: 'PUT', body: input }),
  rsvpSummary: () => request<RsvpSummary>('/rsvp/summary'),
  guestNames: () => request<GuestName[]>('/guests/names'),

  getVoterState: () => request<VoterState>('/me/state'),

  saveVote: (entryId: number, input: UpsertVote) =>
    request<VoterVote>(`/votes/${entryId}`, { method: 'PUT', body: input }),

  saveBallot: (awardId: string, entryId: number) =>
    request<{ awardId: string; entryId: number }>(`/award-ballots/${encodeURIComponent(awardId)}`, {
      method: 'PUT',
      body: { entryId },
    }),

  clearBallot: (awardId: string) =>
    request<void>(`/award-ballots/${encodeURIComponent(awardId)}`, { method: 'DELETE' }),

  // --- admin ---
  adminLogin: (password: string) =>
    request<void>('/admin/login', { method: 'POST', admin: true, password }),
  adminConfig: () => request<ContestConfig>('/admin/config', { admin: true }),
  adminResults: () => request<ContestResults>('/admin/results', { admin: true }),
  adminGuests: () => request<AdminGuest[]>('/admin/guests', { admin: true }),
  adminMailStatus: () => request<{ configured: boolean }>('/admin/mail-status', { admin: true }),
  addGuests: (guests: NewGuest[]) =>
    request<AddGuestsResult>('/admin/guests', { method: 'POST', body: { guests }, admin: true }),
  inviteLink: (guestId: string) =>
    request<{ url: string }>(`/admin/guests/${encodeURIComponent(guestId)}/invite-link`, {
      method: 'POST',
      admin: true,
    }),
  sendInvites: (selector: SendInvites) =>
    request<SendInvitesResult>('/admin/guests/invite', {
      method: 'POST',
      body: selector,
      admin: true,
    }),

  previewEmail: (input: CustomEmailPreview) =>
    request<{ subject: string; html: string }>('/admin/email/preview', {
      method: 'POST',
      body: input,
      admin: true,
    }),
  sendCustomEmail: (input: CustomEmail) =>
    request<SendInvitesResult>('/admin/email/send', { method: 'POST', body: input, admin: true }),

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

  renameGuest: (guestId: string, newName: string) =>
    request<void>(`/admin/guests/${encodeURIComponent(guestId)}`, {
      method: 'PUT',
      body: { newName },
      admin: true,
    }),
  deleteGuest: (guestId: string) =>
    request<{ votes: number; ballots: number }>(`/admin/guests/${encodeURIComponent(guestId)}`, {
      method: 'DELETE',
      admin: true,
    }),
};

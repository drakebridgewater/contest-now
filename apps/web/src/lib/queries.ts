import type {
  ContestConfig,
  Entry,
  GuestName,
  RsvpSummary,
  SessionGuest,
  VoterState,
} from '@contest/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from './api.ts';

export const queryKeys = {
  contest: ['contest'] as const,
  entries: ['entries'] as const,
  me: ['me'] as const,
  voter: (guestId: string) => ['voter', guestId] as const,
  profile: ['profile'] as const,
  rsvpSummary: ['rsvp-summary'] as const,
  guestNames: ['guest-names'] as const,
  adminConfig: ['admin', 'config'] as const,
  adminResults: ['admin', 'results'] as const,
  adminGuests: ['admin', 'guests'] as const,
  adminMailStatus: ['admin', 'mail-status'] as const,
};

export function useContest(): UseQueryResult<ContestConfig> {
  return useQuery({
    queryKey: queryKeys.contest,
    queryFn: api.getContest,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useEntries(): UseQueryResult<Entry[]> {
  return useQuery({
    queryKey: queryKeys.entries,
    queryFn: api.getEntries,
    staleTime: 10_000,
    // New entries keep arriving while people are voting.
    refetchInterval: 30_000,
  });
}

/** Who this device is signed in as; `null` when signed out. */
export function useMe(enabled = true): UseQueryResult<SessionGuest | null> {
  return useQuery({ queryKey: queryKeys.me, queryFn: api.me, staleTime: 60_000, enabled });
}

export function useVoterState(guestId: string | null): UseQueryResult<VoterState> {
  return useQuery({
    queryKey: queryKeys.voter(guestId ?? ''),
    queryFn: api.getVoterState,
    enabled: Boolean(guestId),
    staleTime: 5_000,
  });
}

export function useRsvpSummary(): UseQueryResult<RsvpSummary> {
  return useQuery({
    queryKey: queryKeys.rsvpSummary,
    queryFn: api.rsvpSummary,
    staleTime: 30_000,
  });
}

export function useGuestNames(): UseQueryResult<GuestName[]> {
  return useQuery({ queryKey: queryKeys.guestNames, queryFn: api.guestNames, staleTime: 30_000 });
}

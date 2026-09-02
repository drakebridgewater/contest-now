import type { ContestConfig, Entry, VoterState } from '@contest/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from './api.ts';

export const queryKeys = {
  contest: ['contest'] as const,
  entries: ['entries'] as const,
  voter: (name: string) => ['voter', name] as const,
  adminConfig: ['admin', 'config'] as const,
  adminResults: ['admin', 'results'] as const,
  adminVoters: ['admin', 'voters'] as const,
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

export function useVoterState(voterName: string | null): UseQueryResult<VoterState> {
  return useQuery({
    queryKey: queryKeys.voter(voterName ?? ''),
    queryFn: () => api.getVoterState(voterName!),
    enabled: Boolean(voterName),
    staleTime: 5_000,
  });
}

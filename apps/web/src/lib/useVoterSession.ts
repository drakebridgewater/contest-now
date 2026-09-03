import type { Rating, VoterState, VoterVote } from '@contest/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from './api.ts';
import { queryKeys, useVoterState } from './queries.ts';
import { useLocalStorage } from './useLocalStorage.ts';

const EMPTY: VoterState = { votes: {}, ballots: {} };

/**
 * The voter's name (remembered on this device) plus their server-side votes and
 * ballots. Writes are optimistic so a tap feels instant on party wifi, and the
 * server response replaces the optimistic value.
 */
export function useVoterSession() {
  const [voterName, setVoterName] = useLocalStorage<string>('contest.voterName', '');
  const active = voterName.trim().length >= 2 ? voterName.trim() : null;
  const query = useVoterState(active);
  const queryClient = useQueryClient();
  const stateKey = queryKeys.voter(active ?? '');

  const patchState = useCallback(
    (patch: (current: VoterState) => VoterState) => {
      queryClient.setQueryData<VoterState>(stateKey, (current) => patch(current ?? EMPTY));
    },
    [queryClient, stateKey],
  );

  const voteMutation = useMutation({
    mutationFn: ({
      entryId,
      scores,
      comment,
    }: {
      entryId: number;
      scores?: Record<string, Rating | null>;
      comment?: string;
    }) =>
      api.saveVote(entryId, {
        voterName: active!,
        ...(scores ? { scores } : {}),
        ...(comment !== undefined ? { comment } : {}),
      }),
    onSuccess: (vote: VoterVote, variables) => {
      patchState((current) => ({
        ...current,
        votes: { ...current.votes, [String(variables.entryId)]: vote },
      }));
    },
  });

  const ballotMutation = useMutation({
    mutationFn: ({ awardId, entryId }: { awardId: string; entryId: number }) =>
      api.saveBallot(awardId, active!, entryId),
    onSuccess: (_result, variables) => {
      patchState((current) => ({
        ...current,
        ballots: { ...current.ballots, [variables.awardId]: variables.entryId },
      }));
    },
  });

  const clearBallotMutation = useMutation({
    mutationFn: ({ awardId }: { awardId: string }) => api.clearBallot(awardId, active!),
    onSuccess: (_result, variables) => {
      patchState((current) => {
        const ballots = { ...current.ballots };
        delete ballots[variables.awardId];
        return { ...current, ballots };
      });
    },
  });

  /** Applies a rating locally right away, then persists it. */
  const setScore = useCallback(
    (entryId: number, criterionId: number, rating: Rating | null) => {
      const key = String(criterionId);
      patchState((current) => {
        const existing = current.votes[String(entryId)] ?? { scores: {}, comment: '' };
        const scores = { ...existing.scores };
        if (rating === null) delete scores[key];
        else scores[key] = rating;
        return {
          ...current,
          votes: { ...current.votes, [String(entryId)]: { ...existing, scores } },
        };
      });
      return voteMutation.mutateAsync({ entryId, scores: { [key]: rating } });
    },
    [patchState, voteMutation],
  );

  const setComment = useCallback(
    (entryId: number, comment: string) => {
      patchState((current) => {
        const existing = current.votes[String(entryId)] ?? { scores: {}, comment: '' };
        return {
          ...current,
          votes: { ...current.votes, [String(entryId)]: { ...existing, comment } },
        };
      });
      return voteMutation.mutateAsync({ entryId, comment });
    },
    [patchState, voteMutation],
  );

  return {
    voterName: active,
    rawVoterName: voterName,
    signIn: (name: string) => setVoterName(name.trim()),
    signOut: () => setVoterName(''),
    state: query.data ?? EMPTY,
    isLoading: query.isLoading,
    setScore,
    setComment,
    pickAward: (awardId: string, entryId: number) =>
      ballotMutation.mutateAsync({ awardId, entryId }),
    clearAward: (awardId: string) => clearBallotMutation.mutateAsync({ awardId }),
  };
}

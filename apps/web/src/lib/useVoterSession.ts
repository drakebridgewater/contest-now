import { impliesTasted, type Rating, type VoterState, type VoterVote } from '@contest/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from './api.ts';
import { queryKeys, useVoterState } from './queries.ts';
import { useLocalStorage } from './useLocalStorage.ts';

const EMPTY: VoterState = { votes: {}, ballots: {} };
const EMPTY_VOTE: VoterVote = { scores: {}, comment: '', tasted: false };

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
      tasted,
    }: {
      entryId: number;
      scores?: Record<string, Rating | null>;
      comment?: string;
      tasted?: boolean;
    }) =>
      api.saveVote(entryId, {
        voterName: active!,
        ...(scores ? { scores } : {}),
        ...(comment !== undefined ? { comment } : {}),
        ...(tasted !== undefined ? { tasted } : {}),
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
      const update = { [key]: rating };
      patchState((current) => {
        const existing = current.votes[String(entryId)] ?? EMPTY_VOTE;
        const scores = { ...existing.scores };
        if (rating === null) delete scores[key];
        else scores[key] = rating;
        // The server applies the same rule; mirroring it keeps the tap instant.
        const tasted = existing.tasted || impliesTasted(update);
        return {
          ...current,
          votes: { ...current.votes, [String(entryId)]: { ...existing, scores, tasted } },
        };
      });
      return voteMutation.mutateAsync({ entryId, scores: update });
    },
    [patchState, voteMutation],
  );

  const setComment = useCallback(
    (entryId: number, comment: string) => {
      patchState((current) => {
        const existing = current.votes[String(entryId)] ?? EMPTY_VOTE;
        return {
          ...current,
          votes: { ...current.votes, [String(entryId)]: { ...existing, comment } },
        };
      });
      return voteMutation.mutateAsync({ entryId, comment });
    },
    [patchState, voteMutation],
  );

  const setTasted = useCallback(
    (entryId: number, tasted: boolean) => {
      patchState((current) => {
        const existing = current.votes[String(entryId)] ?? EMPTY_VOTE;
        return {
          ...current,
          votes: { ...current.votes, [String(entryId)]: { ...existing, tasted } },
        };
      });
      return voteMutation.mutateAsync({ entryId, tasted });
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
    /**
     * The votes have actually arrived. `state` alone cannot say so: it falls back
     * to EMPTY, and `isLoading` is false for the disabled query of a signed-out
     * voter, so callers deriving anything from the votes must wait on this.
     */
    isReady: query.isSuccess,
    setScore,
    setComment,
    setTasted,
    pickAward: (awardId: string, entryId: number) =>
      ballotMutation.mutateAsync({ awardId, entryId }),
    clearAward: (awardId: string) => clearBallotMutation.mutateAsync({ awardId }),
  };
}

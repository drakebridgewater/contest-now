import { impliesTasted, type Rating, type VoterState, type VoterVote } from '@contest/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from './api.ts';
import { queryKeys, useMe, useVoterState } from './queries.ts';

const EMPTY: VoterState = { votes: {}, ballots: {} };
const EMPTY_VOTE: VoterVote = { scores: {}, comment: '', tasted: false };

/**
 * The signed-in guest plus their server-side votes and ballots. The session is
 * a cookie, so "signing in" on the vote page is just typing a name. Writes are
 * optimistic so a tap feels instant on party wifi, and the server response
 * replaces the optimistic value.
 */
export function useVoterSession() {
  const me = useMe();
  const guest = me.data ?? null;
  const guestId = guest?.id ?? null;
  const query = useVoterState(guestId);
  const queryClient = useQueryClient();
  const stateKey = queryKeys.voter(guestId ?? '');

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
      api.saveBallot(awardId, entryId),
    onSuccess: (_result, variables) => {
      patchState((current) => ({
        ...current,
        ballots: { ...current.ballots, [variables.awardId]: variables.entryId },
      }));
    },
  });

  const clearBallotMutation = useMutation({
    mutationFn: ({ awardId }: { awardId: string }) => api.clearBallot(awardId),
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

  const signIn = useCallback(
    async (name: string) => {
      await api.voteSignIn(name.trim());
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    try {
      await api.signOut();
    } finally {
      // Whatever the server said, this device forgets who it was.
      queryClient.setQueryData(queryKeys.me, null);
      queryClient.removeQueries({ queryKey: ['voter'] });
      queryClient.removeQueries({ queryKey: queryKeys.profile });
    }
  }, [queryClient]);

  return {
    guest,
    voterName: guest?.name ?? null,
    /** The `me` query has answered, so a null guest really means signed out. */
    sessionKnown: me.isSuccess,
    signIn,
    signOut,
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

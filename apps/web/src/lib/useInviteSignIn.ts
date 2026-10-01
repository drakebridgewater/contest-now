import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from './api.ts';
import { errorMessage } from './errorMessage.ts';
import { queryKeys } from './queries.ts';

/**
 * Trades an invite link (/event?invite=…) for a session, once. Who we are is
 * only worth asking after that; asking sooner races the exchange and can cache
 * "signed out", so callers hold `useMe` until `settled`.
 */
export function useInviteSignIn(): { settled: boolean; error: string | null } {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const invite = params.get('invite');
  const tried = useRef(false);
  const [settled, setSettled] = useState(invite === null);

  useEffect(() => {
    if (!invite || tried.current) return;
    tried.current = true;
    api
      .inviteSignIn(invite)
      .then(() => {
        queryClient.removeQueries({ queryKey: queryKeys.me });
        // Signed-in guests see more of the event, like its address.
        void queryClient.invalidateQueries({ queryKey: queryKeys.contest });
      })
      .catch((err: unknown) => setError(errorMessage(err, 'That invite link did not work.')))
      .finally(() => {
        setSettled(true);
        // Drop the spent token without jumping the page back to the top.
        setParams({}, { replace: true, preventScrollReset: true });
      });
  }, [invite, queryClient, setParams]);

  return { settled, error };
}

import { useCallback, useEffect, useRef } from 'react';

/**
 * Calls `fn` after `delay` ms of quiet. `flush` runs any pending call now
 * (used on blur so a comment saves the moment the field loses focus).
 */
export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number,
): { call: (...args: A) => void; flush: () => void; cancel: () => void } {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<A | null>(null);
  const latest = useRef(fn);

  // Keep the newest callback without touching the ref during render.
  useEffect(() => {
    latest.current = fn;
  }, [fn]);

  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
  }, []);

  const flush = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    const args = pending.current;
    pending.current = null;
    if (args) latest.current(...args);
  }, []);

  const call = useCallback(
    (...args: A) => {
      pending.current = args;
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        const queued = pending.current;
        pending.current = null;
        if (queued) latest.current(...queued);
      }, delay);
    },
    [delay],
  );

  useEffect(() => cancel, [cancel]);

  return { call, flush, cancel };
}

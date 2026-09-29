import { useEffect, useState } from 'react';

/**
 * The current time, re-read every `intervalMs` while `enabled`. Used to flip a
 * page from "opens at 7:30" to open without waiting for the next refetch.
 */
export function useNow(enabled: boolean, intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);
  return now;
}

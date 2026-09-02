import { useCallback, useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;

/**
 * Signs the voter out after `seconds` of inactivity, for shared/kiosk devices.
 * A deadline ref plus one interval: activity only moves the deadline, so
 * scrolling never tears down timers or causes a re-render storm.
 * Returns null while disabled.
 */
export function useAutoLogout(options: {
  enabled: boolean;
  seconds: number;
  onLogout: () => void;
}): { secondsRemaining: number | null } {
  const { enabled, seconds, onLogout } = options;
  const deadline = useRef(0);
  const lastReset = useRef(0);
  const onLogoutRef = useRef(onLogout);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  useEffect(() => {
    onLogoutRef.current = onLogout;
  }, [onLogout]);

  const reset = useCallback(() => {
    const now = Date.now();
    // Throttle: at most one deadline move per second.
    if (now - lastReset.current < 1000) return;
    lastReset.current = now;
    deadline.current = now + seconds * 1000;
  }, [seconds]);

  useEffect(() => {
    if (!enabled) return;

    deadline.current = Date.now() + seconds * 1000;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining === 0) onLogoutRef.current();
    };
    const interval = setInterval(tick, 500);

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, reset, { passive: true });
    }
    return () => {
      clearInterval(interval);
      setSecondsRemaining(null);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, reset);
    };
  }, [enabled, seconds, reset]);

  return { secondsRemaining: enabled ? secondsRemaining : null };
}

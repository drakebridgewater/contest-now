import { useState, useEffect, useCallback } from 'react';
import { AUTO_LOGOUT_DURATION } from '@/utils/constants';

interface UseAutoLogoutProps {
  isEnabled: boolean;
  isActive: boolean;
  onLogout: () => void;
}

export function useAutoLogout({ isEnabled, isActive, onLogout }: UseAutoLogoutProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [timerId, setTimerId] = useState<{
    timeout: NodeJS.Timeout;
    interval: NodeJS.Timeout;
  } | null>(null);

  const startTimer = useCallback(() => {
    if (!isEnabled || !isActive) return;

    // Clear existing timer
    if (timerId) {
      clearTimeout(timerId.timeout);
      clearInterval(timerId.interval);
    }

    let seconds = AUTO_LOGOUT_DURATION;
    setTimeRemaining(seconds);

    // Countdown timer
    const countdownInterval = setInterval(() => {
      seconds--;
      setTimeRemaining(seconds);
      if (seconds <= 0) {
        clearInterval(countdownInterval);
      }
    }, 1000);

    // Auto-logout timer
    const timeout = setTimeout(() => {
      onLogout();
      clearInterval(countdownInterval);
    }, AUTO_LOGOUT_DURATION * 1000);

    setTimerId({ timeout, interval: countdownInterval });
  }, [isEnabled, isActive, onLogout, timerId]);

  const resetTimer = useCallback(() => {
    if (!isEnabled) return;

    if (timerId) {
      clearTimeout(timerId.timeout);
      clearInterval(timerId.interval);
    }
    setTimeRemaining(0);
    startTimer();
  }, [isEnabled, startTimer, timerId]);

  // Start timer when conditions are met
  useEffect(() => {
    if (isActive && isEnabled) {
      startTimer();
    }

    return () => {
      if (timerId) {
        clearTimeout(timerId.timeout);
        clearInterval(timerId.interval);
      }
    };
  }, [isActive, isEnabled, startTimer, timerId]);

  // Add event listeners for user interaction to reset timer
  useEffect(() => {
    if (!isEnabled || !isActive) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    const resetTimerOnActivity = () => {
      resetTimer();
    };

    // Add event listeners
    for (const event of events) {
      document.addEventListener(event, resetTimerOnActivity, true);
    }

    // Cleanup
    return () => {
      for (const event of events) {
        document.removeEventListener(event, resetTimerOnActivity, true);
      }
    };
  }, [isEnabled, isActive, resetTimer]);

  return {
    timeRemaining,
    resetTimer,
  };
}

import { useEffect, useRef, useCallback } from 'react';
import { useTimerContext } from '../context/TimerContext';

/**
 * useTimer
 * Encapsulates the interval-based countdown logic.
 *
 * @param {Function} [onExpire]  -- callback fired when the timer reaches zero
 * @returns {{ start, pause, resume, reset }}
 */
export function useTimer(onExpire) {
  const {
    duration,
    timeLeft,
    isRunning,
    setTimeLeft,
    setIsRunning,
    setIsPaused,
    setIsExpired,
  } = useTimerContext();

  const intervalRef = useRef(null);

  // Tick every second when running
  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setIsRunning(false);
          setIsExpired(true);
          if (typeof onExpire === 'function') onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [isRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback(() => {
    setTimeLeft(duration);
    setIsExpired(false);
    setIsPaused(false);
    setIsRunning(true);
  }, [duration]); // eslint-disable-line react-hooks/exhaustive-deps

  const pause = useCallback(() => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
    setIsPaused(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resume = useCallback(() => {
    setIsPaused(false);
    setIsRunning(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => {
    clearInterval(intervalRef.current);
    setTimeLeft(duration);
    setIsRunning(false);
    setIsPaused(false);
    setIsExpired(false);
  }, [duration]); // eslint-disable-line react-hooks/exhaustive-deps

  return { start, pause, resume, reset };
}

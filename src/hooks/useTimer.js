import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useTimer
 *
 * A custom React hook that exposes a countdown timer with start, pause,
 * reset, and an optional onExpire callback.
 *
 * @param {number} initialSeconds - Total seconds the timer should count down from.
 * @param {Function} [onExpire]   - Optional callback fired when the timer reaches 0.
 * @returns {{timeLeft: number, isRunning: boolean, start: Function, pause: Function, reset: Function}}
 */
export function useTimer(initialSeconds = 60, onExpire) {
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const intervalRef = useRef(null);

  // Clean up interval on unmount
  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  // Tick logic
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setIsRunning(false);
            if (typeof onExpire === 'function') onExpire();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, onExpire]);

  const start = useCallback(() => {
    if (timeLeft > 0) setIsRunning(true);
  }, [timeLeft]);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
    setTimeLeft(initialSeconds);
  }, [initialSeconds]);

  return { timeLeft, isRunning, start, pause, reset };
}

export default useTimer;

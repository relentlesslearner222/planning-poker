import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * usePokerTimer
 * @param {number} duration - Total countdown seconds (default: 60)
 * @param {Function} onExpire - Callback fired when timer reaches 0
 * @returns {{ timeLeft, isRunning, start, pause, reset }}
 */
export default function usePokerTimer(duration = 60, onExpire) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);
  const onExpireRef = useRef(onExpire);

  // Keep callback ref fresh
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  // Resync timeLeft when duration prop changes
  useEffect(() => {
    setTimeLeft(duration);
  }, [duration]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setIsRunning(false);
            if (onExpireRef.current) onExpireRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const start = useCallback(() => {
    if (timeLeft > 0) setIsRunning(true);
  }, [timeLeft]);

  const pause = useCallback(() => setIsRunning(false), []);

  const reset = useCallback(() => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
    setTimeLeft(duration);
  }, [duration]);

  return { timeLeft, isRunning, start, pause, reset };
}
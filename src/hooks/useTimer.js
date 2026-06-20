import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useTimer
 * @param {number}  initialSeconds  - Total countdown duration in seconds (default 60).
 * @param {Function} onExpiry      - Callback fired when the timer reaches zero.
 * @returns {{ secondsLeft, isRunning, start, pause, reset }}
 */
export function useTimer(initialSeconds = 60, onExpiry = () => {}) {
  const [isRunning, setIsRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onExpiryRef = useRef(onExpiry);

  // Keep callback ref up to date without re-subscribing the interval
  useEffect(() => { onExpiryRef.current = onExpiry; }, [onExpiry]);

  const clearTick = () => {
    if (tickRef.current !== null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  useEffect(() => {
    if (!isRunning) { clearTick(); return; }

    tickRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearTick();
          setIsRunning(false);
          onExpiryRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTick;
  }, [isRunning]);

  const start = useCallback(() => {
    setSecondsLeft((prev) => (prev <= 0 ? initialSeconds : prev));
    setIsRunning(true);
  }, [initialSeconds]);

  const pause = useCallback(() => setIsRunning(false), []);

  const reset = useCallback(() => {
    clearTick();
    setIsRunning(false);
    setSecondsLeft(initialSeconds);
  }, [initialSeconds]);

  return { secondsLeft, isRunning, start, pause, reset };
}

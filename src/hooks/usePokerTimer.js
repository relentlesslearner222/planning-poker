import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * usePokerTimer
 *
 * Custom React hook that encapsulates all countdown-timer logic for
 * a timed planning-poker round.
 *
 * @param {object} options
 * @param {number}   options.duration     - Total round time in seconds (default: 60)
 * @param {function} options.onTimerEnd   - Callback fired when time reaches 0
 * @param {boolean}  options.autoStart    - If true, timer starts on mount (default: false)
 *
 * @returns {object} { timeLeft, isRunning, start, pause, reset }
 */
export function usePokerTimer({ duration = 60, onTimerEnd, autoStart = false } = {}) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef(null);
  const onTimerEndRef = useRef(onTimerEnd);

  // Keep the callback ref fresh without restarting the interval
  useEffect(() => {
    onTimerEndRef.current = onTimerEnd;
  }, [onTimerEnd]);

  // Main tick effect
  useEffect(() => {
    if (!isRunning) {
      clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setIsRunning(false);
          // Fire the onTimerEnd callback (e.g. auto-reveal votes)
          if (typeof onTimerEndRef.current === 'function') {
            onTimerEndRef.current();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  // Reset when duration prop changes
  useEffect(() => {
    setTimeLeft(duration);
    setIsRunning(false);
  }, [duration]);

  const start = useCallback(() => {
    if (timeLeft > 0) {
      setIsRunning(true);
    }
  }, [timeLeft]);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
    setTimeLeft(duration);
  }, [duration]);

  return { timeLeft, isRunning, start, pause, reset };
}
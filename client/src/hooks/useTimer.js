import { useState, useEffect } from 'react';

/**
 * useTimer -- custom hook that returns the remaining milliseconds for a
 * server-supplied timer.
 *
 * @param {number | null} startTime  - epoch ms when the timer was started
 * @param {number | null} durationMs - total duration in ms
 * @returns {number} remainingMs     - ms remaining (>= 0)
 *
 * Design notes:
 *  - Computes remainingMs = durationMs - (Date.now() - startTime) on every
 *    tick so the value is always anchored to the server-recorded startTime
 *    rather than accumulating client-side drift. (AC4)
 *  - Ticks every 100 ms for smooth MM:SS updates without excessive rerenders.
 */
export function useTimer(startTime, durationMs) {
  const [remainingMs, setRemaining] = useState(() => {
    if (startTime == null || durationMs == null) return null;
    return Math.max(0, durationMs - (Date.now() - startTime));
  });

  useEffect(() => {
    if (startTime == null || durationMs == null) {
      setRemaining(null);
      return;
    }

    // Immediately sync on mount / prop change
    setRemaining(Math.max(0, durationMs - (Date.now() - startTime)));

    const id = setInterval(() => {
      const next = Math.max(0, durationMs - (Date.now() - startTime));
      setRemaining(next);
    }, 100);

    return () => clearInterval(id);
  }, [startTime, durationMs]);

  return remainingMs;
}
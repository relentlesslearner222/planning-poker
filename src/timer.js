// timer.js
// Core countdown timer for timer-based Planning Poker (issue #7).

/**
 * Creates a countdown timer.
 *
 * @param {object}   options
 * @param {number}   options.durationSeconds  - Total countdown duration in seconds.
 * @param {function} [options.onTick]         - Called every second with remaining seconds.
 * @param {function} [options.onExpire]       - Called when the timer reaches 0.
 * @returns {{ start, pause, reset, getRemaining, isRunning }}
 */
export function createTimer({ durationSeconds, onTick, onExpire }) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new RangeError('durationSeconds must be a positive finite number');
  }

  let remaining = durationSeconds;
  let intervalId = null;

  function tick() {
    remaining -= 1;
    if (typeof onTick === 'function') onTick(remaining);
    if (remaining <= 0) {
      clearInterval(intervalId);
      intervalId = null;
      remaining = 0;
      if (typeof onExpire === 'function') onExpire();
    }
  }

  return {
    start() {
      if (intervalId !== null) return;
      if (remaining <= 0) return;
      intervalId = setInterval(tick, 1000);
    },
    pause() {
      if (intervalId === null) return;
      clearInterval(intervalId);
      intervalId = null;
    },
    reset() {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      remaining = durationSeconds;
    },
    getRemaining() { return remaining; },
    isRunning() { return intervalId !== null; },
  };
}

/**
 * Formats seconds as MM:SS.
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
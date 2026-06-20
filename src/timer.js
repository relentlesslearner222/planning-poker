/**
 * timer.js
 * Core countdown timer for timer-based Planning Poker (Issue #7)
 *
 * Usage:
 *   const t = createTimer({ duration: 60, onTick, onExpire });
 *   t.start();
 *   t.pause();
 *   t.reset();
 */

/**
 * Creates a countdown timer.
 *
 * @param {object}   options
 * @param {number}   options.duration  - Total seconds to count down from.
 * @param {function} [options.onTick]  - Called every second with remaining seconds.
 * @param {function} [options.onExpire]- Called when the timer reaches zero.
 * @returns {{ start, pause, reset, getRemaining }}
 */
export function createTimer({ duration, onTick, onExpire }) {
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('duration must be a positive finite number');
  }

  let remaining = duration;
  let intervalId = null;
  let running = false;

  function tick() {
    if (remaining <= 0) {
      clearInterval(intervalId);
      intervalId = null;
      running = false;
      if (typeof onExpire === 'function') onExpire();
      return;
    }
    remaining -= 1;
    if (typeof onTick === 'function') onTick(remaining);
    if (remaining === 0) {
      clearInterval(intervalId);
      intervalId = null;
      running = false;
      if (typeof onExpire === 'function') onExpire();
    }
  }

  function start() {
    if (running) return;
    if (remaining <= 0) return;
    running = true;
    intervalId = setInterval(tick, 1000);
  }

  function pause() {
    if (!running) return;
    clearInterval(intervalId);
    intervalId = null;
    running = false;
  }

  function reset(newDuration) {
    pause();
    remaining = newDuration !== undefined ? newDuration : duration;
    if (typeof onTick === 'function') onTick(remaining);
  }

  function getRemaining() {
    return remaining;
  }

  function isRunning() {
    return running;
  }

  return { start, pause, reset, getRemaining, isRunning };
}

/**
 * Formats seconds into MM:SS string.
 * @param {number} seconds
 * @returns {string}
 */
export function formatTime(seconds) {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
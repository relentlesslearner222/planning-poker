/**
 * timerUtils.js
 * Pure helper functions for the server-side planning-poker timer.
 * No side-effects, no I/O — safe to unit-test in isolation.
 */

/**
 * Returns a fresh timer state object.
 * The `serverTickInterval` field holds the setInterval reference while the
 * timer is running; it is intentionally excluded when the state is serialised
 * and sent to clients (see broadcastTimer in index.js).
 *
 * @param {number} [durationSeconds=300]  Default 5 minutes.
 * @returns {TimerState}
 */
function createTimerState(durationSeconds = 300) {
  return {
    durationSeconds,
    remainingSeconds: durationSeconds,
    status: 'idle',          // 'idle' | 'running' | 'paused' | 'finished'
    serverTickInterval: null, // setInterval ref — NOT sent to clients
    startedAt: null,          // epoch ms when last started/resumed
    pausedAt: null,           // epoch ms when paused
  };
}

/**
 * Converts a raw seconds value into a "MM:SS" display string.
 *
 * @param {number} totalSeconds  Must be >= 0; decimals are floored.
 * @returns {string}  e.g. 305 → "05:05", 0 {�""00:00"
 */
function formatTime(totalSeconds) {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Produces the serialisable snapshot of a timer state that is safe to
 * broadcast to clients (strips the interval reference and internal epoch
 * timestamps that are only meaningful on the server).
 *
 * @param {TimerState} timer
 * @returns {{ durationSeconds: number, remainingSeconds: number, status: string }}
 */
function serializeTimer(timer) {
  return {
    durationSeconds: timer.durationSeconds,
    remainingSeconds: timer.remainingSeconds,
    status: timer.status,
  };
}

module.exports = { createTimerState, formatTime, serializeTimer };
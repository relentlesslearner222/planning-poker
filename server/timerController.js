/**
 * timerController.js
 *
 * Encapsulates the per-room countdown timer lifecycle.
 * All timer state lives on the server; clients receive authoritative ticks.
 *
 * AC3 — setInterval emits timer:tick every second
 * AC4 — emits timer:expired / votes:roveal on zero or all-voted
 * AC6 — status is always one of idle | running | paused | expired
 */

'use strict';

const DEFAULT_DURATION = 60; // seconds

/**
 * Build a fresh timer sub-object for a new room.
 * @returns {Object} timer state
 */
function createTimer() {
  return {
    duration: DEFAULT_DURATION,
    remaining: DEFAULT_DURATION,
    status: 'idle',       // idle | running | paused | expired
    intervalRef: null,
  };
}

/**
 * Configure the timer duration (host only, while idle or paused).
 *
 * @param {Object} room        - room object from roomManager
 * @param {number} duration    - desired duration in seconds (10--300)
 */
function configure(room, duration) {
  const d = Math.max(10, Math.min(300, Number(duration)));
  if (isNaN(d)) return;
  if (room.timer.status === 'running') return;
  room.timer.duration = d;
  room.timer.remaining = d;
}

/**
 * Start (or resume) the countdown for a room.
 *
 * @param {Object}   room      - room object from roomManager
 * @param {Function} emitTick  - (payload) => void  -- broadcasts timer:tick to the room
 * @param {Function} onExpire  - () => void          -- called when remaining hits 0
 */
function start(room, emitTick, onExpire) {
  if (room.timer.status === 'running' || room.timer.status === 'expired') return;
  if (room.timer.remaining <= 0) return;

  room.timer.status = 'running';

  room.timer.intervalRef = setInterval(() => {
    room.timer.remaining -= 1;

    emitTick({
      remaining: room.timer.remaining,
      total: room.timer.duration,
      status: room.timer.status,
    });

    if (room.timer.remaining <= 0) {
      _expire(room, onExpire);
    }
  }, 1000);
}

/**
 * Pause the running countdown.
 *
 * @param {Object} room
 */
function pause(room) {
  if (room.timer.status !== 'running') return;
  _clearInterval(room);
  room.timer.status = 'paused';
}

/**
 * Reset the timer back to the configured duration.
 *
 * @param {Object} room
 */
function reset(room) {
  _clearInterval(room);
  room.timer.remaining = room.timer.duration;
  room.timer.status = 'idle';
}

/**
 * Called when all participants have voted before the timer expires.
 * Stops the interval and triggers the expiry callback.
 *
 * @param {Object}   room
 * @param {Function} onExpire
 */
function earlyReveal(room, onExpire) {
  if (room.timer.status !== 'running') return;
  _expire(room, onExpire);
}

// --- Internal helpers ------------------------------------------------------

function _expire(room, onExpire) {
  _clearInterval(room);
  room.timer.remaining = 0;
  room.timer.status = 'expired';
  if (typeof onExpire === 'function') onExpire();
}

function _clearInterval(room) {
  if (room.timer.intervalRef) {
    clearInterval(room.timer.intervalRef);
    room.timer.intervalRef = null;
  }
}

/**
 * Return a serialisable snapshot of the timer (safe to send over the wire).
 *
 * @param {Object} room
 * @returns {{ duration, remaining, status, total }}
 */
function getState(room) {
  return {
    duration: room.timer.duration,
    remaining: room.timer.remaining,
    total: room.timer.duration,
    status: room.timer.status,
  };
}

module.exports = {
  createTimer,
  configure,
  start,
  pause,
  reset,
  earlyReveal,
  getState,
};

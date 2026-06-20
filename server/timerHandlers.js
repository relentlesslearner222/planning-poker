/**
 * timerHandlers.js
 *
 * Registers all timer:* Socket.io event handlers on a connected socket.
 * All timer state lives on the server; remaining time is computed from
 * Date.now() so there is zero client-side drift.
 *
 * Expected room shape (additions):
 *  {
 *   hostSocketId : string,
 *   timer: {
 *     duration  : number,   // ms
 *     status    : 'idle' | 'running' | 'paused' | 'expired',
 *     startedAt : number,   // Date.now() when last (re)started
 *     pausedAt  : number,   // Date.now() when paused
 *     elapsed   : number,   // ms elapsed before most-recent pause
 *   },
 *   _timerInterval: ReturnType<typeof setInterval> | null,
 * }
 */

'use strict';

const TICK_MS = 500; // broadcast cadence

// ─── helpers ──────────────────────────────────────────────

/**
 * Compute how many milliseconds are left given current timer state.
 * Pure function – safe to call at any time.
 */
function computeRemaining(timer) {
  if (timer.status === 'idle')    return timer.duration;
  if (timer.status === 'expired') return 0;
  if (timer.status === 'paused') {
    return Math.max(0, timer.duration - timer.elapsed);
  }
  // running
  const elapsedNow = timer.elapsed + (Date.now() - timer.startedAt);
  return Math.max(0, timer.duration - elapsedNow);
}

/**
 * Build the payload for a timer:state broadcast.
 */
function buildStatePayload(timer) {
  return {
    status:    timer.status,
    remaining: computeRemaining(timer),
    duration:  timer.duration,
  };
}

/**
 * Stop the server-side setInterval tick, if running.
 */
function clearTick(room) {
  if (room._timerInterval) {
    clearInterval(room._timerInterval);
    room._timerInterval = null;
  }
}

/**
 * Broadcast timer:state to every socket in roomId.
 */
function broadcastState(io, roomId, timer) {
  io.to(roomId).emit('timer:state', buildStatePayload(timer));
}

/**
 * Start the server-side tick that drives timer:state broadcasts and
 * fires timer:expired when remaining reaches 0.
 */
function startTick(io, roomId, room, onExpire) {
  clearTick(room);

  room._timerInterval = setInterval(() => {
    const remaining = computeRemaining(room.timer);
    broadcastState(io, roomId, room.timer);

    if (remaining <= 0) {
      clearTick(room);
      room.timer.status = 'expired';
      io.to(roomId).emit('timer:expired');
      if (typeof onExpire === 'function') onExpire();
    }
  }, TICK_MS);
}

// ─── guard helpers ───────────────────────────────────────────

function isHost(room, socketId) {
  return room && room.hostSocketId === socketId;
}

// ─── exported registration function ───────────────────────────────────────

/**
 * Call once per connected socket inside your `io.on('connection', ▖)` handler.
 *
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server}  io
 * @param {Map<string, object>}         rooms   - shared room-state map
 * @param {(roomId:string)=>void}       onAllVoted - callback to trigger
 *                                                 early reveal when every
 *                                                 participant has voted
 */
function registerTimerHandlers(socket, io, rooms, onAllVoted) {

  // ▖ timer:configure ────────────────────────────────────────────────
  // Payload: { duration: number }  (milliseconds)
  socket.on('timer:configure', ({ duration } = {}) => {
    const roomId = socket.roomId; // set by your join logic
    const room   = rooms.get(roomId);
    if (!room || !isHost(room, socket.id)) return;
    if (typeof duration !== 'number' || duration <= 0) return;

    // Reset any running timer before reconfiguring
    clearTick(room);
    room.timer = {
      duration,
      status:    'idle',
      startedAt: 0,
      pausedAt:  0,
      elapsed:   0,
    };

    broadcastState(io, roomId, room.timer);
  });

  // ▖ timer:start ───────────────────────────────────────────────────
  socket.on('timer:start', () => {
    const roomId = socket.roomId;
    const room   = rooms.get(roomId);
    if (!room || !isHost(room, socket.id)) return;

    const { timer } = room;
    if (timer.status === 'running' || timer.status === 'expired') return;

    timer.startedAt = Date.now();
    timer.status    = 'running';

    broadcastState(io, roomId, timer);
    startTick(io, roomId, room, () => {
      // onExpire: lock voting & auto-reveal (delegated to caller)
      if (typeof onAllVoted === 'function') onAllVoted(roomId, true);
    });
  });

  // ▖ imer:pause ─────────────────────────────────────────────────
  socket.on('timer:pause', () => {
    const roomId = socket.roomId;
    const room   = rooms.get(roomId);
    if (!room || !isHost(room, socket.id)) return;

    const { timer } = room;
    if (timer.status !== 'running') return;

    timer.pausedAt = Date.now();
    timer.elapsed += timer.pausedAt - timer.startedAt;
    timer.status   = 'paused';

    clearTick(room);
    broadcastState(io, roomId, timer);
  });

  // ▖ timer:reset ────────────────────────────────────────────────
  socket.on('timer:reset', () => {
    const roomId = socket.roomId;
    const room   = rooms.get(roomId);
    if (!room || !isHost(room, socket.id)) return;

    clearTick(room);
    room.timer = {
      duration:  room.timer.duration, // preserve configured duration
      status:    'idle',
      startedAt: 0,
      pausedAt:  0,
      elapsed:   0,
    };

    broadcastState(io, roomId, room.timer);
  });
}

// ─── host-reassignment helper (call on disconnect) ──────────────────────────────────

/**
 * If the disconnecting socket was the host, promote the next oldest member.
 * Returns the new hostSocketId (or null if room is now empty).
 *
 * @param {object}   room
 * @param {string}   disconnectedSocketId
 * @param {string[]} remainingSocketIds  - ordered oldest-first
 */
function reassignHost(room, disconnectedSocketId, remainingSocketIds) {
  if (room.hostSocketId !== disconnectedSocketId) return room.hostSocketId;
  if (remainingSocketIds.length === 0) return null;
  room.hostSocketId = remainingSocketIds[0];
  return room.hostSocketId;
}

/**
 * Call when ALL participants have voted.
 * Stops the timer early, marks it expired, and emits timer:expired.
 */
function triggerEarlyReveal(io, roomId, room) {
  if (!room || room.timer.status === 'expired') return;
  clearTick(room);
  room.timer.status = 'expired';
  io.to(roomId).emit('timer:expired');
}

module.exports = {
  registerTimerHandlers,
  reassignHost,
  triggerEarlyReveal,
  computeRemaining,
};
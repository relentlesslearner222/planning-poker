/**
 * timerManager.js
 * ----------------
 * Manages server-side timer state per room.
 * Handles socket events: timer:configure, timer:start, timer:pause,
 * timer:resume, timer:reset.
 * Emits: timer:started, timer:tick, timer:paused, timer:resumed,
 *        timer:ended, timer:reset, timer:sync
 *
 * All timer authority lives here — clients are stateless (AC9).
 */

'use strict';

/**
 * Default timer sub-object attached to every room.
 * @returns {object}
 */
function createTimerState() {
  return {
    status: 'idle',      // 'idle' | 'running' | 'paused' | 'ended'
    durationMs: 5 * 60 * 1000, // default 5 min
    startedAt: null,
    pausedAt: null,
    remainingOnPause: null,
  };
}

/**
 * Map<roomId, NodeJS.Timeout>  --- one interval per running room.
 */
const roomIntervals = new Map();

// ─── helpers ────────────────────────────────────────────────────────────────────────────────────

function clearRoomInterval(roomId) {
  if (roomIntervals.has(roomId)) {
    clearInterval(roomIntervals.get(roomId));
    roomIntervals.delete(roomId);
  }
}

/**
 * Compute remaining milliseconds for a running timer.
 * @param {object} timer
 * @returns {number}
 */
function computeRemaining(timer) {
  if (timer.status === 'paused') return timer.remainingOnPause;
  if (timer.status !== 'running') return timer.durationMs;
  return timer.durationMs - (Date.now() - timer.startedAt);
}

/**
 * Resolve the next host when the current host leaves.
 * The "next oldest" member is the first entry in room.members (insertion-order).
 * @param {object} room
 * @param {string} leavingSocketId
 * @returns {string|null}
 */
function resolveNextHost(room, leavingSocketId) {
  const remaining = room.members.filter((socketId) => socketId !== leavingSocketId);
  return remaining.length > 0 ? remaining[0] : null;
}

// ─── main export ────────────────────────────────────────────────────────────────────────────────────

/**
 * Register all timer-related socket event handlers for one connected socket.
 *
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 * @param {Map<string, object>} rooms  --- the app's shared room registry
 *
 * Each room object is expected to have at minimum:
 *   { hostSocketId, members: string[], votes: Map|object, timer: object }
 */
function registerTimerHandlers(socket, io, rooms) {
  // ── guard helper ────────────────────────────────────────────────────────────────────────
  function isHost(roomId) {
    const room = rooms.get(roomId);
    return room && room.hostSocketId === socket.id;
  }

  function getRoom(roomId) {
    return rooms.get(roomId);
  }

  // ─— timer:configure ────────────────────────────────────────────────────────────────────────────────
  // Payload: { roomId, durationMs }
  socket.on('timer:configure', ({ roomId, durationMs }) => {
    if (!isHost(roomId)) return;
    const room = getRoom(roomId);
    if (!room) return;

    // Only allow configuration when idle or paused
    if (room.timer.status === 'running') return;

    room.timer.durationMs = durationMs;
    // Emit sync so all clients show the updated duration
    io.to(roomId).emit('timer:sync', buildSyncPayload(room.timer));
  });

  // ─ ─ timer:start ───────────────────────────────────────────────────────────────────────────────────
  // Payload: { roomId }
  socket.on('timer:start', ({ roomId }) => {
    if (!isHost(roomId)) return;
    const room = getRoom(roomId);
    if (!room) return;
    if (room.timer.status === 'running') return;

    clearRoomInterval(roomId);

    room.timer.status = 'running';
    room.timer.startedAt = Date.now();
    room.timer.pausedAt = null;
    room.timer.remainingOnPause = null;

    // AC3: emit timer:started to the whole room
    io.to(roomId).emit('timer:started', buildSyncPayload(room.timer));

    // Start per-room interval (AC4)
    const interval = setInterval(() => {
      const r = getRoom(roomId);
      if (!r || r.timer.status !== 'running') {
        clearRoomInterval(roomId);
        return;
      }

      const remaining = computeRemaining(r.timer);

      // AC4: emit timer:tick every second
      io.to(roomId).emit('timer:tick', { remaining });

      // AC6: auto-end when remaining <= 0
      if (remaining <= 0) {
        endTimer(roomId, room, io);
      }
    }, 1000);

    roomIntervals.set(roomId, interval);
  });

  // ─ ─ timer:pause ────────────────────────────────────────────────────────────────────────────────
  // Payload: { roomId }
  socket.on('timer:pause', ({ roomId }) => {
    if (!isHost(roomId)) return;
    const room = getRoom(roomId);
    if (!room || room.timer.status !== 'running') return;

    clearRoomInterval(roomId);

    const remaining = computeRemaining(room.timer);
    room.timer.status = 'paused';
    room.timer.pausedAt = Date.now();
    room.timer.remainingOnPause = remaining;

    // AC7
    io.to(roomId).emit('timer:paused', buildSyncPayload(room.timer));
  });

  // ─ ─ timer:resume ───────────────────────────────────────────────────────────────────────────────
  // Payload: { roomId }
  socket.on('timer:resume', ({ roomId }) => {
    if (!isHost(roomId)) return;
    const room = getRoom(roomId);
    if (!room || room.timer.status !== 'paused') return;

    // AC7: recompute startedAt so that (durationMs - (now - startedAt)) === remainingOnPause
    room.timer.startedAt = Date.now() - (room.timer.durationMs - room.timer.remainingOnPause);
    room.timer.status = 'running';
    room.timer.pausedAt = null;
    room.timer.remainingOnPause = null;

    io.to(roomId).emit('timer:resumed', buildSyncPayload(room.timer));

    // Restart tick interval
    const interval = setInterval(() => {
      const r = getRoom(roomId);
      if (!r || r.timer.status !== 'running') {
        clearRoomInterval(roomId);
        return;
      }

      const remaining = computeRemaining(r.timer);
      io.to(roomId).emit('timer:tick', { remaining });

      if (remaining <= 0) {
        endTimer(roomId, r, io);
      }
    }, 1000);

    roomIntervals.set(roomId, interval);
  });

  // ─ ─ timer:reset ────────────────────────────────────────────────────────────────────────────────
  // Payload: { roomId }
  socket.on('timer:reset', ({ roomId }) => {
    if (!isHost(roomId)) return;
    const room = getRoom(roomId);
    if (!room) return;

    clearRoomInterval(roomId);

    // AC8: reset timer state
    room.timer = createTimerState();

    // AC8: clear all votes
    if (room.votes) {
      if (room.votes instanceof Map) {
        room.votes.clear();
      } else {
        room.votes = {};
      }
    }

    io.to(roomId).emit('timer:reset', buildSyncPayload(room.timer));
  });
}

// ─── shared utilities (also used by the main server join/leave logic) ─────────────────────────────────

/**
 * Immediately end a running timer, lock voting, and auto-reveal votes. (AC6)
 * @param {string} roomId
 * @param {object} room
 * @param {import('socket.io').Server} io
 */
function endTimer(roomId, room, io) {
  clearRoomInterval(roomId);
  room.timer.status = 'ended';
  io.to(roomId).emit('timer:ended', buildSyncPayload(room.timer));
}

/**
 * Build the payload sent with every timer:* event so clients can fully re-sync.
 * @param {object} timer
 * @returns {object}
 */
function buildSyncPayload(timer) {
  return {
    status: timer.status,
    durationMs: timer.durationMs,
    startedAt: timer.startedAt,
    pausedAt: timer.pausedAt,
    remainingOnPause: timer.remainingOnPause,
  };
}

/**
 * Called whenever a socket disconnects.
 * Reassigns host if the departing socket was the room host. (AC1)
 *
 * @param {string} socketId
 * @param {Map<string, object>} rooms
 * @param {import('socket.io').Server} io
 */
function handleHostDisconnect(socketId, rooms, io) {
  for (const [roomId, room] of rooms.entries()) {
    if (room.hostSocketId === socketId) {
      const nextHost = resolveNextHost(room, socketId);
      room.hostSocketId = nextHost;
      if (nextHost) {
        io.to(roomId).emit('host:changed', { hostSocketId: nextHost });
      }
    }
    // Remove from members list
    if (Array.isArray(room.members)) {
      room.members = room.members.filter((sockId) => sockId !== socketId);
    }
  }
}

module.exports = {
  createTimerState,
  registerTimerHandlers,
  handleHostDisconnect,
  endTimer,
  buildSyncPayload,
  computeRemaining,
};

/**
 * timerHandler.js
 * -----------------
 * Server-side timer logic for timer-based Planning Poker (Issue #10).
 *
 * Responsibilities:
 *  - Track the host (first socket to join a room; re-assigned on disconnect)
 *  - Handle timer:start, timer:pause, timer:reset socket events (host-only)
 *  - Broadcast timer:started, timer:paused, timer:reset, timer:expired
 *  - Auto-reveal votes when timer expires OR all participants have voted
 *  - Include full timer state in room snapshots for reconnecting clients (AC9)
 *
 * Room shape extension (all fields added by this module):
 *  {
 *    hostSocketId    : string | null,
 *    memberOrder     : string[],          // socket IDs in join order
 *    timerDuration   : number,            // ms
 *    timerStartTime  : number | null,     // server Date.now() when last started
 *    timerState      : 'idle'|'running'|'paused',
 *    timerPausedAt   : number | null,     // ms remaining when paused
 *    timerNodeRef    : NodeJS.Timeout | null,
 *  }
 */

const DEFAULT_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const TICK_INTERVAL_MS    = 500;            // server-side polling interval

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the ms remaining for a running timer, or 0 if expired.
 * @param {object} room
 * @returns {number}
 */
function getRemainingMs(room) {
  if (room.timerState === 'paused') {
    return room.timerPausedAt ?? room.timerDuration;
  }
  if (room.timerState === 'running' && room.timerStartTime != null) {
    const elapsed = Date.now() - room.timerStartTime;
    return Math.max(0, room.timerDuration - elapsed);
  }
  return room.timerPausedAt ?? room.timerDuration;
}

/**
 * Serialises timer state for inclusion in a room snapshot.
 * @param {object} room
 * @returns {object}
 */
function timerSnapshot(room) {
  return {
    timerDuration  : room.timerDuration,
    timerStartTime : room.timerStartTime,
    timerState     : room.timerState,
    timerPausedAt  : room.timerPausedAt,
    remainingMs    : getRemainingMs(room),
  };
}

/**
 * Stops and clears the server-side tick interval for a room.
 * @param {object} room
 */
function clearTick(room) {
  if (room.timerNodeRef != null) {
    clearInterval(room.timerNodeRef);
    room.timerNodeRef = null;
  }
}

// ---------------------------------------------------------------------------
// Core timer actions
// ---------------------------------------------------------------------------

/**
 * Initialise timer fields on a newly-created room object.
 * Call this wherever rooms are first created in server.js.
 * @param {object} room  - the room object to mutate
 */
function initTimerState(room) {
  room.hostSocketId   = null;
  room.memberOrder    = [];
  room.timerDuration  = DEFAULT_DURATION_MS;
  room.timerStartTime = null;
  room.timerState     = 'idle';
  room.timerPausedAt  = null;
  room.timerNodeRef   = null;
}

/**
 * Called whenever a socket joins a room.
 * Assigns hostSocketId to the first member; subsequent members are appended.
 *
 * @param {object} room
 * @param {string} socketId
 * @param {import('socket.io').Server} io
 * @param {string} roomId
 */
function onSocketJoin(room, socketId, io, roomId) {
  if (!room.memberOrder) room.memberOrder = [];
  if (!room.memberOrder.includes(socketId)) {
    room.memberOrder.push(socketId);
  }
  if (!room.hostSocketId) {
    room.hostSocketId = socketId;
    io.to(socketId).emit('timer:hostAssigned', { hostSocketId: socketId });
  }
  // Always send current timer snapshot to the joining/reconnecting client
  io.to(socketId).emit('timer:sync', timerSnapshot(room));
}

/**
 * Called whenever a socket leaves or disconnects from a room.
 * Re-assigns host to the next oldest member if the host left.
 *
 * @param {object} room
 * @param {string} socketId
 * @param {import('socket.io').Server} io
 * @param {string} roomId
 */
function onSocketLeave(room, socketId, io, roomId) {
  if (!room.memberOrder) return;
  room.memberOrder = room.memberOrder.filter((id) => id !== socketId);

  if (room.hostSocketId === socketId) {
    room.hostSocketId = room.memberOrder[0] ?? null;
    if (room.hostSocketId) {
      io.to(room.hostSocketId).emit('timer:hostAssigned', {
        hostSocketId: room.hostSocketId,
      });
      io.to(roomId).emit('timer:hostChanged', { hostSocketId: room.hostSocketId });
    }
  }
}

// ---------------------------------------------------------------------------
// Socket event registration
// ---------------------------------------------------------------------------

/**
 * Registers all timer-related socket event handlers on a connected socket.
 *
 * Usage in server.js:
 *   registerTimerHandlers(io, socket, rooms, revealVotes);
 *
 * @param {import('socket.io').Server}  io
 * @param {import('socket.io').Socket}  socket
 * @param {Map<string, object>}         rooms       - shared rooms map
 * @param {function(string): void}      revealVotes - existing reveal logic
 */
function registerTimerHandlers(io, socket, rooms, revealVotes) {

  // timer:start
  socket.on('timer:start', ({ roomId, durationMs } = {}) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostSocketId) return;

    clearTick(room);

    if (durationMs != null) {
      const clamped = Math.min(Math.max(durationMs, 60_000), 600_000);
      room.timerDuration = clamped;
    }

    if (room.timerState === 'paused' && room.timerPausedAt != null) {
      room.timerStartTime = Date.now() - (room.timerDuration - room.timerPausedAt);
    } else {
      room.timerStartTime = Date.now();
    }

    room.timerState   = 'running';
    room.timerPausedAt = null;

    io.to(roomId).emit('timer:started', {
      serverStartTime : room.timerStartTime,
      durationMs      : room.timerDuration,
    });

    room.timerNodeRef = setInterval(() => {
      const remaining = getRemainingMs(room);
      if (remaining <= 0) {
        _expireTimer(io, room, roomId, revealVotes);
      }
    }, TICK_INTERVAL_MS);
  });

  // timer:pause
  socket.on('timer:pause', ({ roomId } = {}) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostSocketId) return;
    if (room.timerState !== 'running') return;

    clearTick(room);
    room.timerPausedAt = getRemainingMs(room);
    room.timerState    = 'paused';

    io.to(roomId).emit('timer:paused', { remainingMs: room.timerPausedAt });
  });

  // timer:reset
  socket.on('timer:reset', ({ roomId, durationMs } = {}) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostSocketId) return;

    clearTick(room);
    room.timerState    = 'idle';
    room.timerStartTime = null;
    room.timerPausedAt  = null;
    if (durationMs != null) {
      const clamped = Math.min(Math.max(durationMs, 60_000), 600_000);
      room.timerDuration = clamped;
    }

    io.to(roomId).emit('timer:reset', { durationMs: room.timerDuration });
  });
}

// ---------------------------------------------------------------------------
// Internal: expiry handler
// ---------------------------------------------------------------------------

function _expireTimer(io, room, roomId, revealVotes) {
  if (room.timerState !== 'running') return;
  clearTick(room);
  room.timerState    = 'idle';
  room.timerStartTime = null;
  room.timerPausedAt  = null;

  io.to(roomId).emit('timer:expired');
  revealVotes(roomId);
}

function onAllVoted(io, room, roomId, revealVotes) {
  if (room.timerState === 'running') {
    _expireTimer(io, room, roomId, revealVotes);
  }
}

module.exports = {
  initTimerState,
  onSocketJoin,
  onSocketLeave,
  registerTimerHandlers,
  onAllVoted,
  timerSnapshot,
};

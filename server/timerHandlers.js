/**
 * timerHandlers.js
 * ------------------
 * Registers all timer-related Socket.io event handlers on a socket and
 * manages the server-side countdown state stored per room.
 *
 * Expected room shape (additions):
 *   room.hostId        {string}  socketId of the current moderator/host
 *   room.participants {string[]} ordered list of socketIds (join order)
 *   room.timer        {object}  see createTimerState()
 *
 * Call registerTimerHandlers(io, socket, rooms) inside the
 * io.on('connection', ...) callback, passing:
 *   io    - the Socket.io Server instance
 *   socket - the connected socket
 *   rooms  - the shared rooms Map/object used by the rest of the app
 */

'use strict';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return a fresh, idle timer state object. */
function createTimerState(durationMs = 60000) {
  return {
    status: 'idle',      // 'idle' | 'running' | 'paused' | 'expired'
    durationMs,
    remainingMs: durationMs,
    startedAt: null,
    intervalId: null,
  };
}

/**
 * Broadcast the current timer state to every socket in a room.
 * We only send the fields clients need (no intervalId / startedAt).
 */
function broadcastTick(io, roomId, timer) {
  io.to(roomId).emit('timer:tick', {
    status: timer.status,
    remainingMs: timer.remainingMs,
    durationMs: timer.durationMs,
  });
}

/**
 * Reveal votes for the room and emit votes:revealed.
 * Delegates to the existing reveal logic already present in the room object.
 */
function revealVotes(io, roomId, room) {
  if (room.revealed) return;
  room.revealed = true;
  stopInterval(room.timer);
  room.timer.status = 'expired';
  io.to(roomId).emit('votes:revealed', { votes: room.votes || null });
  broadcastTick(io, roomId, room.timer);
}

/** Clear the setInterval stored on the timer object (if any). */
function stopInterval(timer) {
  if (timer.intervalId !== null) {
    clearInterval(timer.intervalId);
    timer.intervalId = null;
  }
}

/**
 * Check whether all participants in the room have voted.
 */
function allVoted(room) {
  if (!room.participants || room.participants.length === 0) return false;
  return room.participants.every(
    (pid) => room.votes && room.votes[pid] !== undefined && room.votes[pid] !== null,
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Attach timer event listeners to `socket`.
 * Must be called once per connected socket inside io.on('connection').
 *
 * @param {import('socket.io').Server}  io
 * @param {import('socket.io').Socket}  socket
 * @param {Map<string, object>}         rooms   shared room state map
 */
function registerTimerHandlers(io, socket, rooms) {

  function getRoomForSocket() {
    for (const [roomId, room] of rooms.entries()) {
      if (room.participants && room.participants.includes(socket.id)) {
        return { roomId, room };
      }
    }
    return null;
  }

  function isHost(room) {
    return room.hostId === socket.id;
  }

  // timer:configure  -------------------------------------------------------
  socket.on('timer:configure', ({ durationMs } = {}) => {
    const ctx = getRoomForSocket();
    if (!ctx) return;
    const { roomId, room } = ctx;
    if (!isHost(room)) return;
    const ms = Number(durationMs);
    if (!ms || ms <= 0) return;
    if (room.timer.status === 'running') return;
    stopInterval(room.timer);
    room.timer = createTimerState(ms);
    broadcastTick(io, roomId, room.timer);
  });

  // timer:start -------------------------------------------------------------
  socket.on('timer:start', () => {
    const ctx = getRoomForSocket();
    if (!ctx) return;
    const { roomId, room } = ctx;
    if (!isHost(room)) return;
    if (room.timer.status === 'running' || room.timer.status === 'expired') return;

    room.timer.status = 'running';
    room.timer.startedAt = Date.now();
    broadcastTick(io, roomId, room.timer);

    room.timer.intervalId = setInterval(() => {
      const elapsed = Date.now() - room.timer.startedAt;
      room.timer.startedAt = Date.now();
      room.timer.remainingMs = Math.max(0, room.timer.remainingMs - elapsed);
      broadcastTick(io, roomId, room.timer);
      if (room.timer.remainingMs <= 0) {
        stopInterval(room.timer);
        room.timer.status = 'expired';
        revealVotes(io, roomId, room);
      }
    }, 1000);
  });

  // timer:pause -------------------------------------------------------------
  socket.on('timer:pause', () => {
    const ctx = getRoomForSocket();
    if (!ctx) return;
    const { roomId, room } = ctx;
    if (!isHost(room)) return;
    if (room.timer.status !== 'running') return;
    const elapsed = Date.now() - room.timer.startedAt;
    room.timer.remainingMs = Math.max(0, room.timer.remainingMs - elapsed);
    stopInterval(room.timer);
    room.timer.status = 'paused';
    broadcastTick(io, roomId, room.timer);
  });

  // timer:reset -------------------------------------------------------------
  socket.on('timer:reset', () => {
    const ctx = getRoomForSocket();
    if (!ctx) return;
    const { roomId, room } = ctx;
    if (!isHost(room)) return;
    stopInterval(room.timer);
    room.timer = createTimerState(room.timer.durationMs);
    room.revealed = false;
    broadcastTick(io, roomId, room.timer);
  });

  // vote: check all-voted condition -----------------------------------------
  socket.on('vote', ({ roomId, vote } = {}) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (!room.votes) room.votes = {};
    room.votes[socket.id] = vote;
    if (room.timer.status === 'running' && allVoted(room)) {
      revealVotes(io, roomId, room);
    }
  });

  // disconnect: host re-assignment ------------------------------------------
  socket.on('disconnect', () => {
    for (const [roomId, room] of rooms.entries()) {
      if (!room.participants) continue;
      const idx = room.participants.indexOf(socket.id);
      if (idx === -1) continue;
      room.participants.splice(idx, 1);
      if (room.votes) delete room.votes[socket.id];
      if (room.participants.length === 0) {
        stopInterval(room.timer);
        rooms.delete(roomId);
        break;
      }
      if (room.hostId === socket.id) {
        room.hostId = room.participants[0];
        io.to(roomId).emit('host:changed', { hostId: room.hostId });
      }
      break;
    }
  });
}

// ---------------------------------------------------------------------------
// Room initialisation helpers
// ---------------------------------------------------------------------------

/**
 * Initialise timer state on a newly-created room object.
 * Also sets up the hostId and participants array if not already present.
 */
function initRoom(room, firstSocketId) {
  if (!room.participants) room.participants = [];
  if (!room.votes) room.votes = {};
  room.participants.push(firstSocketId);
  room.hostId = firstSocketId;
  room.timer = createTimerState();
  room.revealed = false;
}

/**
 * Called when a subsequent participant joins an existing room.
 * Sends the current timer state directly to the joining socket.
 */
function onParticipantJoin(socket, room, roomId) {
  if (!room.participants.includes(socket.id)) {
    room.participants.push(socket.id);
  }
  socket.emit('timer:tick', {
    status: room.timer.status,
    remainingMs: room.timer.remainingMs,
    durationMs: room.timer.durationMs,
  });
  socket.emit('host:changed', { hostId: room.hostId });
}

module.exports = { registerTimerHandlers, initRoom, onParticipantJoin, createTimerState };

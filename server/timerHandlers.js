/**
 * timerHandlers.js
 *
 * Registers all timer-related Socket.io event handlers for a given socket/room.
 * Room state shape (added fields):
 *   room.hostSocketId      {string}  - socket.id of the moderator/host
 *   room.timerDuration     {number}  - configured duration in ms
 *   room.timerStartedAt    {number}  - epoch ms when last started/resumed
 *   room.timerRemainingMs  {number}  - ms remaining at last pause (null when running)
 *   room.timerStatus       {string}  - 'idle' | 'running' | 'paused' | 'expired'
 *   room.timerInterval     {*}       - setInterval handle (server-internal)
 */

'use strict';

/** Clears the server-side interval stored on a room object. */
function clearRoomInterval(room) {
  if (room && room.timerInterval != null) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
}

/** Returns true if every participant has submitted a vote. */
function allParticipantsVoted(room) {
  const participants = room.participants || [];
  if (participants.length === 0) return false;
  const votes = room.votes || {};
  return participants.every((id) => votes[id] != null);
}

/** Reveals all votes and locks voting. */
function revealVotes(room, io, roomId) {
  room.votesRevealed = true;
  room.votingLocked = true;
  io.to(roomId).emit('votes:revealed', { votes: room.votes || {} });
}

/**
 * Registers timer Socket.io event handlers on the given socket.
 */
function registerTimerHandlers(socket, io, rooms, roomId) {
  function isHost() {
    const room = rooms[roomId];
    return room && socket.id === room.hostSocketId;
  }

  function startWatchdog(room) {
    clearRoomInterval(room);
    room.timerInterval = setInterval(() => {
      const r = rooms[roomId];
      if (!r || r.timerStatus !== 'running') {
        clearRoomInterval(r);
        return;
      }
      const remaining = r.timerDuration - (Date.now() - r.timerStartedAt);
      if (allParticipantsVoted(r)) {
        clearRoomInterval(r);
        r.timerStatus = 'idle';
        revealVotes(r, io, roomId);
        io.to(roomId).emit('timer:stopped');
        return;
      }
      if (remaining <= 0) {
        clearRoomInterval(r);
        r.timerStatus = 'expired';
        revealVotes(r, io, roomId);
        io.to(roomId).emit('timer:expired');
      }
    }, 500);
  }

  // timer:start
  socket.on('timer:start', ({ duration } = {}) => {
    if (!isHost()) return;
    const room = rooms[roomId];
    if (!room) return;

    const secs = Math.min(300, Math.max(10, Number(duration) || 60));
    const durationMs = secs * 1000;

    room.timerDuration = durationMs;
    room.timerStartedAt = Date.now();
    room.timerRemainingMs = null;
    room.timerStatus = 'running';
    room.votingLocked = false;
    room.votesRevealed = false;

    io.to(roomId).emit('timer:started', {
      startedAt: room.timerStartedAt,
      durationMs: room.timerDuration,
    });

    startWatchdog(room);
  });

  // timer:pause
  socket.on('timer:pause', () => {
    if (!isHost()) return;
    const room = rooms[roomId];
    if (!room || room.timerStatus !== 'running') return;

    clearRoomInterval(room);
    const elapsed = Date.now() - room.timerStartedAt;
    room.timerRemainingMs = Math.max(0, room.timerDuration - elapsed);
    room.timerStatus = 'paused';

    io.to(roomId).emit('timer:paused', { remainingMs: room.timerRemainingMs });
  });

  // timer:resume
  socket.on('timer:resume', () => {
    if (!isHost()) return;
    const room = rooms[roomId];
    if (!room || room.timerStatus !== 'paused') return;

    room.timerStartedAt = Date.now();
    room.timerDuration = room.timerRemainingMs;
    room.timerStatus = 'running';

    io.to(roomId).emit('timer:resumed', {
      startedAt: room.timerStartedAt,
      remainingMs: room.timerRemainingMs,
    });

    startWatchdog(room);
  });

  // timer:reset
  socket.on('timer:reset', () => {
    if (!isHost()) return;
    const room = rooms[roomId];
    if (!room) return;

    clearRoomInterval(room);
    room.timerDuration = null;
    room.timerStartedAt = null;
    room.timerRemainingMs = null;
    room.timerStatus = 'idle';
    room.votingLocked = false;
    room.votesRevealed = false;
    room.votes = {};

    io.to(roomId).emit('timer:reset');
  });
}

/** Initial timer state slice for a new room. */
function initialTimerState() {
  return {
    hostSocketId: null,
    timerDuration: null,
    timerStartedAt: null,
    timerRemainingMs: null,
    timerStatus: 'idle',
    timerInterval: null,
  };
}

/** Builds the payload for a timer:sync event. */
function timerSyncPayload(room) {
  return {
    status: room.timerStatus || 'idle',
    startedAt: room.timerStartedAt || null,
    durationMs: room.timerDuration || null,
    remainingMs: room.timerRemainingMs || null,
  };
}

module.exports = {
  registerTimerHandlers,
  initialTimerState,
  timerSyncPayload,
  clearRoomInterval,
};
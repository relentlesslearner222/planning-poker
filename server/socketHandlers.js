/**
 * socketHandlers.js
 * Registers all Socket.io event handlers including timer events.
 *
 * Expected usage:
 *   const { registerHandlers } = require('./socketHandlers');
 *   registerHandlers(io, socket);
 */

const {
  joinRoom,
  leaveRoom,
  allVoted,
  getTimerStatePayload,
  getRoomStatePayload,
  rooms,
} = require('./roomManager');

/**
 * Compute remaining ms from server clock.
 * @param {object} timerState
 * @returns {number}
 */
function computeRemaining(timerState) {
  if (!timerState.running) {
    return timerState.remainingAtPause !== null
      ? timerState.remainingAtPause
      : timerState.durationMs;
  }
  const elapsed = Date.now() - timerState.startedAt;
  return Math.max(0, timerState.durationMs - elapsed);
}

function buildSyncPayload(room) {
  const remaining = computeRemaining(room.timerState);
  return {
    remaining,
    running: room.timerState.running,
    totalDuration: room.timerConfig.durationMs,
  };
}

function stopTimer(room) {
  if (room.timerState.intervalId) {
    clearInterval(room.timerState.intervalId);
    room.timerState.intervalId = null;
  }
  room.timerState.running = false;
}

function revealVotes(io, roomId, room) {
  stopTimer(room);
  room.votingLocked = true;
  io.to(roomId).emit('votes:roveal', { votes: room.votes });
}

function startTimerInterval(io, roomId, room) {
  stopTimer(room);
  room.timerState.running = true;
  room.timerState.intervalId = setInterval(() => {
    const remaining = computeRemaining(room.timerState);
    io.to(roomId).emit('timer:sync', buildSyncPayload(room));
    if (remaining <= 0) {
      revealVotes(io, roomId, room);
    }
  }, 1000);
}

function registerHandlers(io, socket) {
  let currentRoomId = null;

  socket.on('room:join', ({ roomId }) => {
    currentRoomId = roomId;
    const room = joinRoom(roomId, socket.id);
    socket.join(roomId);
    socket.emit('room:state', getRoomStatePayload(room));
    io.to(roomId).emit('room:updated', getRoomStatePayload(room));
  });

  socket.on('vote:submit', ({ roomId, value }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.votingLocked) return;
    room.votes[socket.id] = value;
    io.to(roomId).emit('votes:updated', { votes: room.votes });
    if (allVoted(room)) {
      revealVotes(io, roomId, room);
    }
  });

  // ------------------------------------
  // Timer events
  // ------------------------------------

  socket.on('timer:configure', ({ roomId, durationMs }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.hostSocketId !== socket.id) {
      socket.emit('timer:error', { message: 'Not authorized' });
      return;
    }
    const validDuration = Math.min(300000, Math.max(10000, Math.round(durationMs / 10000) * 10000));
    room.timerConfig.durationMs = validDuration;
    room.timerState.durationMs = validDuration;
  });

  socket.on('timer:start', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.hostSocketId !== socket.id) {
      socket.emit('timer:error', { message: 'Not authorized' });
      return;
    }
    room.timerState.startedAt = Date.now();
    room.timerState.durationMs = room.timerConfig.durationMs;
    room.timerState.remainingAtPause = null;
    room.timerState.pausedAt = null;
    startTimerInterval(io, roomId, room);
    io.to(roomId).emit('timer:sync', buildSyncPayload(room));
  });

  socket.on('timer:pause', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.hostSocketId !== socket.id) {
      socket.emit('timer:error', { message: 'Not authorized' });
      return;
    }
    const remaining = computeRemaining(room.timerState);
    room.timerState.remainingAtPause = remaining;
    room.timerState.pausedAt = Date.now();
    stopTimer(room);
    io.to(roomId).emit('timer:sync', buildSyncPayload(room));
  });

  socket.on('timer:resume', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.hostSocketId !== socket.id) {
      socket.emit('timer:error', { message: 'Not authorized' });
      return;
    }
    const remaining = room.timerState.remainingAtPause !== null
      ? room.timerState.remainingAtPause
      : room.timerState.durationMs;
    room.timerState.startedAt = Date.now();
    room.timerState.durationMs = remaining;
    room.timerState.remainingAtPause = null;
    room.timerState.pausedAt = null;
    startTimerInterval(io, roomId, room);
    io.to(roomId).emit('timer:sync', buildSyncPayload(room));
  });

  socket.on('timer:reset', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.hostSocketId !== socket.id) {
      socket.emit('timer:error', { message: 'Not authorized' });
      return;
    }
    stopTimer(room);
    room.votes = {};
    room.votingLocked = false;
    room.timerState.startedAt = null;
    room.timerState.durationMs = room.timerConfig.durationMs;
    room.timerState.remainingAtPause = null;
    room.timerState.pausedAt = null;
    io.to(roomId).emit('room:state', getRoomStatePayload(room));
    io.to(roomId).emit('timer:sync', buildSyncPayload(room));
  });

  socket.on('disconnect', () => {
    if (!currentRoomId) return;
    const room = leaveRoom(currentRoomId, socket.id);
    if (room) {
      io.to(currentRoomId).emit('room:updated', getRoomStatePayload(room));
    }
  });
}

module.exports = { registerHandlers };
/**
 * timerHandlers.js
 *
 * Registers all server-side Socket.io handlers for the planning-poker
 * countdown timer feature (issue #10).
 *
 * Supported client->server events:
 *   timer:configure  { duration: number }  -- set duration (host only)
 *   timer:start                            -- begin countdown (host only)
 *   timer:pause                            -- pause countdown (host only)
 *   timer:reset                            -- reset to configured duration (host only)
 *
 * Emitted server->room events:
 *   timer:started   { endsAt, duration }
 *   timer:tick      { secondsLeft }
 *   timer:paused    { secondsLeft }
 *   timer:reset     { duration }
 *   timer:expired
 *   timer:stopped
 */

'use strict';

/**
 * Attach timer handlers to a connected socket.
 *
 * @param {import('socket.io').Socket} socket   - The connecting socket.
 * @param {import('socket.io').Server} io       - The Socket.io server instance.
 * @param {Map<string, object>}        rooms    - Shared in-memory room-state map.
 * @param {Function}                    revealVotes - Existing reveal-votes helper.
 */
function registerTimerHandlers(socket, io, rooms, revealVotes) {
  // helpers

  function getRoom() {
    const roomId = socket.data.roomId;
    return roomId ? rooms.get(roomId) : null;
  }

  function broadcastToRoom(room, event, payload) {
    io.to(room.id).emit(event, payload);
  }

  function clearRoomInterval(room) {
    if (room.timerInterval) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
    }
  }

  function secondsLeft(room) {
    return Math.max(0, Math.ceil((room.timerEndsAt - Date.now()) / 1000));
  }

  // timer:configure
  socket.on('timer:configure', ({ duration } = {}) => {
    const room = getRoom();
    if (!room) return;
    if (room.hostId !== socket.id) return;
    const clamped = Math.min(300, Math.max(10, Number(duration) || 60));
    room.timerDuration = clamped;
    broadcastToRoom(room, 'timer:reset', { duration: clamped });
  });

  // timer:start
  socket.on('timer:start', () => {
    const room = getRoom();
    if (!room) return;
    if (room.hostId === undefined || room.hostId !== socket.id) return;

    clearRoomInterval(room);

    const duration = room.timerDuration || 60;
    const endsAt = Date.now() + duration * 1000;

    room.timerEndsAt = endsAt;
    room.timerActive = true;
    room.timerPaused = false;

    broadcastToRoom(room, 'timer:started', { endsAt, duration });

    room.timerInterval = setInterval(() => {
      const remaining = secondsLeft(room);
      broadcastToRoom(room, 'timer:tick', { secondsLeft: remaining });

      if (remaining <= 0) {
        clearRoomInterval(room);
        room.timerActive = false;
        room.timerEndsAt = null;
        broadcastToRoom(room, 'timer:expired', null);
        if (typeof revealVotes === 'function') revealVotes(room, io);
      }
    }, 1000);
  });

  // timer:pause
  socket.on('timer:pause', () => {
    const room = getRoom();
    if (!room) return;
    if (room.hostId !== socket.id) return;
    if (!room.timerActive || room.timerPaused) return;

    clearRoomInterval(room);
    const remaining = secondsLeft(room);
    room.timerPaused = true;
    room.timerActive = false;
    room.timerRemainingMs = remaining * 1000;
    broadcastToRoom(room, 'timer:paused', { secondsLeft: remaining });
  });

  // timer:reset
  socket.on('timer:reset', () => {
    const room = getRoom();
    if (!room) return;
    if (room.hostId !== socket.id) return;

    clearRoomInterval(room);
    room.timerActive = false;
    room.timerPaused = false;
    room.timerEndsAt = null;
    room.timerRemainingMs = null;

    const duration = room.timerDuration || 60;
    broadcastToRoom(room, 'timer:reset', { duration });
  });
}

/**
 * Stop the timer for a room early (all votes submitted before expiry).
 * Call this from the vote-submission handler in server/index.js.
 *
 * @param {object}                   room        - Room state object.
 * @param {import('socket.io').Server} io        - Socket.io server instance.
 * @param {Function}                 revealVotes  - Existing reveal-votes helper.
 */
function stopTimerEarly(room, io, revealVotes) {
  if (!room.timerActive) return;

  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }

  room.timerActive = false;
  room.timerEndsAt = null;

  io.to(room.id).emit('timer:stopped', null);

  if (typeof revealVotes === 'function') revealVotes(room, io);
}

module.exports = { registerTimerHandlers, stopTimerEarly };
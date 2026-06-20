// server/index.js
// Planning Poker -- Server with Timer Support (Issue #10)

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

/**
 * rooms Map<roomId, RoomState>
 *
 * RoomState = {
 *   participants: Map<socketId, { name, vote }>,
 *   hostSocketId: String | null,
 *   revealed: Boolean,
 *   timer: { startTime: Number, durationMs: Number, intervalRef: Timeout | null }
 * }
 */
const rooms = new Map();

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      participants: new Map(),
      hostSocketId: null,
      revealed: false,
      timer: { startTime: null, durationMs: null, intervalRef: null },
    });
  }
  return rooms.get(roomId);
}

function clearTimer(room) {
  if (room.timer.intervalRef) {
    clearInterval(room.timer.intervalRef);
    room.timer.intervalRef = null;
  }
  room.timer.startTime = null;
  room.timer.durationMs = null;
}

function allVoted(room) {
  if (room.participants.size === 0) return false;
  for (const p of room.participants.values()) {
    if (p.vote === null || p.vote === undefined) return false;
  }
  return true;
}

function reassignHost(roomId, room) {
  const next = room.participants.keys().next().value;
  if (next) {
    room.hostSocketId = next;
    io.to(next).emit('host:assigned', { socketId: next });
  } else {
    room.hostSocketId = null;
  }
}

// ----------------------------------------------------------------------------
// Socket.io connection handler
// ----------------------------------------------------------------------------

io.on('connection', (socket) => {
  let currentRoomId = null;

  // ---- room:join -----------------------------------------------------------
  socket.on('room:join', ({ roomId, name }) => {
    const room = getOrCreateRoom(roomId);
    currentRoomId = roomId;

    // First participant becomes host
    if (room.participants.size === 0) {
      room.hostSocketId = socket.id;
    }

    room.participants.set(socket.id, { name: name || socket.id, vote: null });
    socket.join(roomId);

    // Inform joining client whether they are the host
    socket.emit('host:status', { isHost: room.hostSocketId === socket.id });

    // AC11: replay active timer state to rejoining/new client
    if (room.timer.startTime !== null) {
      socket.emit('timer:started', {
        startTime: room.timer.startTime,
        durationMs: room.timer.durationMs,
      });
    }

    // Broadcast updated participant list
    io.to(roomId).emit('room:update', {
      participants: Array.from(room.participants.entries()).map(([id, p]) => ({
        id,
        name: p.name,
        voted: p.vote !== null,
      })),
      hostSocketId: room.hostSocketId,
    });
  });

  // ---- vote:submit --------------------------------------------------------
  socket.on('vote:submit', ({ vote }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || room.revealed) return;

    const participant = room.participants.get(socket.id);
    if (!participant) return;
    participant.vote = vote;

    io.to(currentRoomId).emit('room:update', {
      participants: Array.from(room.participants.entries()).map(([id, p]) => ({
        id,
        name: p.name,
        voted: p.vote !== null,
      })),
      hostSocketId: room.hostSocketId,
    });

    // AC8: all participants voted --> stop timer + reveal
    if (allVoted(room)) {
      if (room.timer.intervalRef) {
        clearTimer(room);
        io.to(currentRoomId).emit('timer:stopped');
      }
      room.revealed = true;
      io.to(currentRoomId).emit('votes:reveal', {
        votes: Array.from(room.participants.entries()).map(([id, p]) => ({ id, name: p.name, vote: p.vote })),
      });
    }
  });

  // ---- timer:start --------------------------------------------------------
  socket.on('timer:start', ({ durationMs }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    // Only host may start the timer (AC2, T6)
    if (room.hostSocketId !== socket.id) {
      socket.emit('timer:error', { message: 'Only the host may start the timer.' });
      return;
    }

    // Server-side validation: [10000, 300000] ms (AC4)
    const clamped = Math.min(Math.max(durationMs, 10000), 300000);

    // Clear any existing timer
    clearTimer(room);

    const startTime = Date.now();
    room.timer.startTime = startTime;
    room.timer.durationMs = clamped;

    // AC3: broadcast timer:started
    io.to(currentRoomId).emit('timer:started', { startTime, durationMs: clamped });

    // Server-side 1s interval to detect expiry (AC10)
    room.timer.intervalRef = setInterval(() => {
      const remaining = clamped - (Date.now() - startTime);
      if (remaining <= 0) {
        clearTimer(room);
        room.revealed = true;
        // AC7: auto-reveal
        io.to(currentRoomId).emit('votes:reveal', {
          votes: Array.from(room.participants.entries()).map(([id, p]) => ({ id, name: p.name, vote: p.vote })),
        });
      }
    }, 1000);
  });

  // ---- timer:cancel -------------------------------------------------------
  socket.on('timer:cancel', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    // Only host may cancel (AC9)
    if (room.hostSocketId !== socket.id) {
      socket.emit('timer:error', { message: 'Only the host may cancel the timer.' });
      return;
    }

    clearTimer(room);
    // AC9: no reveal on cancel
    io.to(currentRoomId).emit('timer:stopped');
  });

  // ---- disconnect ---------------------------------------------------------
  socket.on('disconnect', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    room.participants.delete(socket.id);

    // AC1: host reassignment
    if (room.hostSocketId === socket.id) {
      reassignHost(currentRoomId, room);
    }

    if (room.participants.size === 0) {
      // Clean up empty room
      clearTimer(room);
      rooms.delete(currentRoomId);
    } else {
      io.to(currentRoomId).emit('room:update', {
        participants: Array.from(room.participants.entries()).map(([id, p]) => ({
          id,
          name: p.name,
          voted: p.vote !== null,
        })),
        hostSocketId: room.hostSocketId,
      });
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

module.exports = { app, server, io, rooms }; // exported for testing
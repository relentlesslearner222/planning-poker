/**
 * server/index.js
 *
 * Planning Poker — Server Entry Point
 *
 * Timer feature additions (issue #10):
 *  - Room state extended with `hostSocketId` and `timer` fields.
 *  - First socket to join a room becomes the host (AC1).
 *  - If host disconnects the next-oldest member is promoted (AC1).
 *  - Handles `timer:start`  → broadcasts `timer:started`  (AC3).
 *  - Handles `timer:reset`   → broadcasts `timer:reset`    (AC8).
 *  - Server-side setTimeout fires `timer:expired`        (AC5).
 *  - All-voted path stops timer early and reveals votes   (AC6).
 *  - New joiners receive current timer state in room:sync (AC10).
 */

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// --------------------------------------------------------------------------
// In-memory room store
// --------------------------------------------------------------------------

/**
 * rooms: Map<roomId, RoomState>
 *
 * RoomState shape:
 * {
 *   id:            string,
 *   participants:  Map<socketId, { name: string, vote: string|null }>,
 *   hostSocketId:  string | null,
 *   revealed:      boolean,
 *   timer: {
 *     status:     'idle' | 'running' | 'expired',
 *     endsAt:     number | null,
 *     timeoutRef: ReturnType<typeof setTimeout> | null
 *   }
 * }
 */
const rooms = new Map();

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      participants: new Map(),
      hostSocketId: null,
      revealed: false,
      timer: {
        status:     'idle',
        endsAt:     null,
        timeoutRef: null,
      },
    });
  }
  return rooms.get(roomId);
}

function buildParticipantList(room) {
  return Array.from(room.participants.entries()).map(([id, p]) => ({
    socketId: id,
    name:     p.name,
    vote:     room.revealed ? p.vote : (p.vote !== null ? '\u2713' : null),
  }));
}

function broadcastRoomState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  io.to(roomId).emit('room:update', {
    participants: buildParticipantList(room),
    revealed:     room.revealed,
    hostSocketId: room.hostSocketId,
    timer: {
      status: room.timer.status,
      endsAt: room.timer.endsAt,
    },
  });
}

/**
 * revealVotes -- marks the room as revealed and broadcasts.
 * Called on timer expiry (AC5) and all-voted early-finish (AC6).
 */
function revealVotes(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.revealed = true;

  if (room.timer.timeoutRef) {
    clearTimeout(room.timer.timeoutRef);
    room.timer.timeoutRef = null;
  }
  room.timer.status = 'expired';

  io.to(roomId).emit('timer:expired');
  broadcastRoomState(roomId);
}

/**
 * checkAllVoted -- if every participant has voted, stop timer and reveal.
 * Implements AC6.
 */
function checkAllVoted(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.revealed) return;
  if (room.participants.size === 0) return;

  const allVoted = Array.from(room.participants.values()).every(
    (p) => p.vote !== null
  );
  if (allVoted) revealVotes(roomId);
}

// --------------------------------------------------------------------------
// Socket.io event handlers
// --------------------------------------------------------------------------

io.on('connection', (socket) => {
  let currentRoomId = null;

  // join:room
  socket.on('join:room', ({ roomId, name }) => {
    if (!roomId || !name) return;
    currentRoomId = roomId;
    socket.join(roomId);
    const room = getOrCreateRoom(roomId);

    // First joiner becomes host (AC1)
    if (room.participants.size === 0) {
      room.hostSocketId = socket.id;
    }
    room.participants.set(socket.id, { name, vote: null });

    // Send full state snapshot to new joiner (AC10)
    socket.emit('room:sync', {
      roomId,
      participants:  buildParticipantList(room),
      revealed:      room.revealed,
      hostSocketId:  room.hostSocketId,
      timer: {
        status: room.timer.status,
        endsAt: room.timer.endsAt,
      },
    });
    broadcastRoomState(roomId);
  });

  // vote:submit
  socket.on('vote:submit', ({ vote }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || room.revealed) return;
    const participant = room.participants.get(socket.id);
    if (!participant) return;
    participant.vote = vote;
    broadcastRoomState(currentRoomId);
    checkAllVoted(currentRoomId); // AC6
  });

  // timer:start (AC3)
  socket.on('timer:start', ({ durationSeconds }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return;
    if (room.timer.status === 'running') return;

    const duration = Math.min(300, Math.max(10, Number(durationSeconds) || 60));
    const endsAt   = Date.now() + duration * 1000;

    if (room.timer.timeoutRef) clearTimeout(room.timer.timeoutRef);

    room.timer.status     = 'running';
    room.timer.endsAt     = endsAt;
    room.timer.timeoutRef = setTimeout(() => {
      revealVotes(currentRoomId);
    }, duration * 1000);

    io.to(currentRoomId).emit('timer:started', { endsAt });
    broadcastRoomState(currentRoomId);
  });

  // timer:reset (AC8)
  socket.on('timer:reset', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return;

    if (room.timer.timeoutRef) {
      clearTimeout(room.timer.timeoutRef);
      room.timer.timeoutRef = null;
    }
    room.timer.status = 'idle';
    room.timer.endsAt = null;
    room.revealed = false;
    room.participants.forEach((p) => { p.vote = null; });

    io.to(currentRoomId).emit('timer:reset');
    broadcastRoomState(currentRoomId);
  });

  // disconnect (AC1 host re-election)
  socket.on('disconnect', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    room.participants.delete(socket.id);

    if (room.participants.size === 0) {
      if (room.timer.timeoutRef) clearTimeout(room.timer.timeoutRef);
      rooms.delete(currentRoomId);
      return;
    }

    // Re-elect host: next oldest = first entry in insertion-ordered Map
    if (room.hostSocketId === socket.id) {
      room.hostSocketId = room.participants.keys().next().value;
    }
    broadcastRoomState(currentRoomId);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Planning Poker server listening on port ${PORT}`);
});
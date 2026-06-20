// server.js  -- Planning Poker with server-synchronised timer (issue #10)
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');

const app     = express();
const server  = http.createServer(app);
const io      = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'client/build')));
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'client/build/index.html')));

// ------------------------------------------------------------------
// Room state
// ------------------------------------------------------------------
/**
 * rooms: Map<roomId, {
 *   host: string | null,
 *   participants: Map<socketId, { name, vote: string|null }>,
 *   votesRevealed: boolean,
 *   votingLocked: boolean,
 *   timer: { durationSeconds, endTimestamp, pausedRemaining, status, serverInterval }
 * }>
 */
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      host: null,
      participants: new Map(),
      votesRevealed: false,
      votingLocked: false,
      timer: {
        durationSeconds: 60,
        endTimestamp: null,
        pausedRemaining: null,
        status: 'stopped',
        serverInterval: null,
      },
    });
  }
  return rooms.get(roomId);
}

// ------------------------------------------------------------------
// Timer helpers
// ------------------------------------------------------------------
function clearTimer(room) {
  if (room.timer.serverInterval) {
    clearInterval(room.timer.serverInterval);
    room.timer.serverInterval = null;
  }
}

function startServerTick(roomId, room) {
  clearTimer(room);
  room.timer.serverInterval = setInterval(() => {
    const now       = Date.now();
    const remaining = Math.max(0, room.timer.endTimestamp - now);

    io.to(roomId).emit('timer:tick', {
      roomId,
      remainingMs: remaining,
      endTimestamp: room.timer.endTimestamp,
    });

    if (remaining <= 0) {
      clearTimer(room);
      room.timer.status     = 'stopped';
      room.votingLocked     = true;
      room.votesRevealed    = true;
      io.to(roomId).emit('timer:expired', { roomId, votes: serialiseVotes(room) });
    }
  }, 1000);
}

function serialiseVotes(room) {
  const result = {};
  for (const [socketId, data] of room.participants) {
    result[socketId] = data;
  }
  return result;
}

function checkAllVoted(roomId, room) {
  if (room.timer.status !== 'running') return;
  const participants = [...room.participants.values()];
  if (participants.length === 0) return;
  const allVoted = participants.every((p) => p.vote !== null);
  if (allVoted) {
    clearTimer(room);
    room.timer.status     = 'stopped';
    room.votingLocked     = true;
    room.votesRevealed    = true;
    io.to(roomId).emit('timer:expired', {
      roomId,
      reason: 'all-voted',
      votes: serialiseVotes(room),
    });
  }
}

// ------------------------------------------------------------------
// Socket.io
// ------------------------------------------------------------------
io.on('connection', (socket) => {
  let currentRoomId = null;

  // --- Join room ---
  socket.on('join-room', ({ roomId, name }) => {
    currentRoomId = roomId;
    socket.join(roomId);
    const room = getOrCreateRoom(roomId);

    // AC1: first participant becomes host
    if (!room.host) {
      room.host = socket.id;
    }

    room.participants.set(socket.id, { name: name || socket.id, vote: null });

    // Send full room state to the new joiner
    socket.emit('room-state', {
      roomId,
      host: room.host,
      participants: serialiseVotes(room),
      votesRevealed: room.votesRevealed,
      votingLocked: room.votingLocked,
      timer: {
        durationSeconds: room.timer.durationSeconds,
        endTimestamp: room.timer.endTimestamp,
        pausedRemaining: room.timer.pausedRemaining,
        status: room.timer.status,
      },
    });

    // Notify others
    socket.to(roomId).emit('participant-joined', {
      socketId: socket.id,
      name: name || socket.id,
      host: room.host,
    });
  });

  // --- Vote ---
  socket.on('submit-vote', ({ roomId, vote }) => {
    const room = rooms.get(roomId);
    if (!room || room.votingLocked) return;
    const participant = room.participants.get(socket.id);
    if (!participant) return;
    participant.vote = vote;
    io.to(roomId).emit('vote-updated', { socketId: socket.id, vote });
    checkAllVoted(roomId, room); // AC6
  });

  // --- Timer: configure ---
  socket.on('timer:configure', ({ roomId, durationSeconds }) => {
    const room = rooms.get(roomId);
    if (!room || room.host !== socket.id) return;
    if (room.timer.status === 'running') return;
    const clamped = Math.min(300, Math.max(10, Number(durationSeconds) || 60));
    room.timer.durationSeconds = clamped;
    io.to(roomId).emit('timer:configured', { roomId, durationSeconds: clamped });
  });

  // --- Timer: start ---
  socket.on('timer:start', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.host !== socket.id) return;
    if (room.timer.status === 'running') return;

    const durationMs              = room.timer.durationSeconds * 1000;
    room.timer.endTimestamp       = Date.now() + durationMs;
    room.timer.pausedRemaining    = null;
    room.timer.status             = 'running';
    room.votingLocked             = false;
    room.votesRevealed            = false;

    io.to(roomId).emit('timer:started', {
      roomId,
      endTimestamp: room.timer.endTimestamp,
      durationSeconds: room.timer.durationSeconds,
    });
    startServerTick(roomId, room);
  });

  // --- Timer: pause ---
  socket.on('timer:pause', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.host !== socket.id) return;
    if (room.timer.status !== 'running') return;

    const remainingMs = Math.max(0, room.timer.endTimestamp - Date.now());
    clearTimer(room);
    room.timer.pausedRemaining = remainingMs;
    room.timer.status          = 'paused';
    room.timer.endTimestamp    = null;

    io.to(roomId).emit('timer:paused', {
      roomId,
      pausedRemaining: remainingMs,
    });
  });

  // --- Timer: resume ---
  socket.on('timer:resume', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.host !== socket.id) return;
    if (room.timer.status !== 'paused') return;

    room.timer.endTimestamp    = Date.now() + room.timer.pausedRemaining;
    room.timer.pausedRemaining = null;
    room.timer.status          = 'running';

    io.to(roomId).emit('timer:resumed', {
      roomId,
      endTimestamp: room.timer.endTimestamp,
    });
    startServerTick(roomId, room);
  });

  // --- Timer: reset ---
  socket.on('timer:reset', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.host !== socket.id) return;

    clearTimer(room);
    room.timer.status          = 'stopped';
    room.timer.endTimestamp    = null;
    room.timer.pausedRemaining = null;
    room.votingLocked          = false;
    room.votesRevealed         = false;

    // Clear all votes
    for (const p of room.participants.values()) p.vote = null;

    io.to(roomId).emit('timer:reset', {
      roomId,
      durationSeconds: room.timer.durationSeconds,
    });
  });

  // --- Disconnect ---
  socket.on('disconnect', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    room.participants.delete(socket.id);

    // AC1: re-assign host if necessary
    if (room.host === socket.id) {
      const [ nextHostId ] = room.participants.keys();
      room.host = nextHostId || null;
      if (room.host) {
        io.to(currentRoomId).emit('host-changed', { host: room.host });
      }
    }

    if (room.participants.size === 0) {
      clearTimer(room);
      rooms.delete(currentRoomId);
    } else {
      io.to(currentRoomId).emit('participant-left', { socketId: socket.id });
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Planning Poker server listening on port ${PORT}`));
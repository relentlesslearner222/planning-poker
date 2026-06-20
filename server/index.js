// server/index.js — Planning Poker with Server-Synchronized Timer
// Issue #10: Timer-Based Planning Poker

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

// ─ In-memory room store
// rooms[roomId] = {
//   members: [{ socketId, name, vote }],  // ordered by join time
//   hostSocketId: string | null,
//   revealed: boolean,
//   timer: { duration, remaining, status, startedAt },
//   intervalId: ReturnType<setInterval> | null,
// }
const rooms = {};

function defaultTimer() {
  return { duration: 60, remaining: 60, status: 'idle', startedAt: null };
}

function getOrCreateRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      members: [],
      hostSocketId: null,
      revealed: false,
      timer: defaultTimer(),
      intervalId: null,
    };
  }
  return rooms[roomId];
}

function broadcastRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  io.to(roomId).emit('room:state', {
    members: room.members.map(({ socketId, name, vote }) => ({
      socketId,
      name,
      vote: room.revealed ? vote : vote != null ? '?' : null,
    })),
    hostSocketId: room.hostSocketId,
    revealed: room.revealed,
    timer: {
      duration: room.timer.duration,
      remaining: room.timer.remaining,
      status: room.timer.status,
    },
  });
}

function startRoomTimer(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  if (room.intervalId) { clearInterval(room.intervalId); room.intervalId = null; }
  room.timer.startedAt = Date.now();
  room.timer.status = 'running';

  room.intervalId = setInterval(() => {
    const r = rooms[roomId];
    if (!r) { clearInterval(room.intervalId); return; }

    const elapsed = Math.floor((Date.now() - r.timer.startedAt) / 1000);
    const remaining = Math.max(0, r.timer.remaining - elapsed);

    io.to(roomId).emit('timer:tick', { remaining, status: r.timer.status });

    if (remaining <= 0) {
      clearInterval(r.intervalId);
      r.intervalId = null;
      r.timer.remaining = 0;
      r.timer.status = 'expired';
      r.revealed = true;
      io.to(roomId).emit('timer:expired');
      broadcastRoomState(roomId);
    } else {
      r.timer.remaining = remaining;
      r.timer.startedAt = Date.now();
    }
  }, 1000);
}

function stopRoomTimer(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  if (room.intervalId) { clearInterval(room.intervalId); room.intervalId = null; }
}

function checkAllVoted(roomId) {
  const room = rooms[roomId];
  if (!room || room.revealed) return;
  const allVoted = room.members.length > 0 && room.members.every((m) => m.vote != null);
  if (allVoted) {
    stopRoomTimer(roomId);
    if (room.timer.status === 'running') room.timer.status = 'idle';
    room.revealed = true;
    broadcastRoomState(roomId);
  }
}

ie.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  socket.on('room:join', ({ roomId, name }) => {
    if (!roomId || !name) return;
    socket.join(roomId);
    const room = getOrCreateRoom(roomId);
    if (room.members.length === 0) room.hostSocketId = socket.id;
    if (!room.members.find((m) => m.socketId === socket.id)) {
      room.members.push({ socketId: socket.id, name, vote: null });
    }
    socket.emit('host:assigned', { isHost: socket.id === room.hostSocketId });
    broadcastRoomState(roomId);
  });

  socket.on('vote:submit', ({ roomId, vote }) => {
    const room = rooms[roomId];
    if (!room || room.revealed) return;
    const member = room.members.find((m) => m.socketId === socket.id);
    if (member) { member.vote = vote; broadcastRoomState(roomId); checkAllVoted(roomId); }
  });

  socket.on('votes:reveal', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    stopRoomTimer(roomId);
    room.revealed = true;
    broadcastRoomState(roomId);
  });

  socket.on('round:reset', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    stopRoomTimer(roomId);
    room.members.forEach((m) => (m.vote = null));
    room.revealed = false;
    room.timer = defaultTimer();
    broadcastRoomState(roomId);
  });

  // AC2, AC3 -- host-only timer controls
  socket.on('timer:configure', ({ roomId, duration }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.hostSocketId) return;
    const clamped = Math.min(300, Math.max(10, Number(duration) || 60));
    stopRoomTimer(roomId);
    room.timer = { duration: clamped, remaining: clamped, status: 'idle', startedAt: null };
    broadcastRoomState(roomId);
  });

  socket.on('timer:start', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.hostSocketId) return;
    if (room.timer.status === 'running') return;
    if (room.timer.status === 'idle' || room.timer.status === 'expired') {
      room.timer.remaining = room.timer.duration;
    }
    startRoomTimer(roomId);
    broadcastRoomState(roomId);
  });

  socket.on('timer:pause', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.hostSocketId) return;
    if (room.timer.status !== 'running') return;
    stopRoomTimer(roomId);
    room.timer.status = 'paused';
    broadcastRoomState(roomId);
  });

  socket.on('timer:reset', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.hostSocketId) return;
    stopRoomTimer(roomId);
    room.timer = { duration: room.timer.duration, remaining: room.timer.duration, status: 'idle', startedAt: null };
    broadcastRoomState(roomId);
  });

  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${socket.id}`);
    for (const [roomId, room] of Object.entries(rooms)) {
      const idx = room.members.findIndex((m) => m.socketId === socket.id);
      if (idx === -1) continue;
      room.members.splice(idx, 1);
      if (room.hostSocketId === socket.id) {
        room.hostSocketId = room.members.length > 0 ? room.members[0].socketId : null;
        if (room.hostSocketId) io.to(room.hostSocketId).emit('host:assigned', { isHost: true });
      }
      if (room.members.length === 0) {
        stopRoomTimer(roomId); delete rooms[roomId];
      } else {
        broadcastRoomState(roomId);
      }
    }
  });
});

app.use(express.static(path.join(__dirname, '..', 'client', 'build')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'client', 'build', 'index.html')));

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log(`Planning Poker server listening on :${PORT}`));
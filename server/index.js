const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'http://localhost:3000', methods: ['GET', 'POST'] },
});

const PORT = 4000;
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      hostSocketId: null,
      players: new Map(),
      revealed: false,
      timer: { intervalId: null, remaining: 0, totalDuration: 0, running: false },
    });
  }
  return rooms.get(roomId);
}

function buildRoomState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  const players = Array.from(room.players.values()).map((p) => ({
    name: p.name,
    voted: p.voted,
    value: room.revealed ? p.value : null,
  }));
  return {
    roomId,
    players,
    revealed: room.revealed,
    timerSync: { remaining: room.timer.remaining, running: room.timer.running, totalDuration: room.timer.totalDuration },
  };
}

function broadcastRoomState(roomId) {
  const state = buildRoomState(roomId);
  if (state) io.to(roomId).emit('room:state', state);
}

io.on('connection', (socket) => {
  let currentRoomId = null;

  socket.on('join', ({ roomId, name }, ack) => {
    if (!roomId || !name) return;
    currentRoomId = roomId;
    const room = getOrCreateRoom(roomId);
    const isHost = room.players.size === 0;
    if (isHost) room.hostSocketId = socket.id;
    room.players.set(socket.id, { name, voted: false, value: null });
    socket.join(roomId);
    broadcastRoomState(roomId);
    if (typeof ack === 'function') ack({ isHost });
  });

  socket.on('vote', ({ value }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;
    player.voted = true;
    player.value = value;
    broadcastRoomState(currentRoomId);
  });

  socket.on('reveal', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || room.hostSocketId !== socket.id) return;
    room.revealed = true;
    broadcastRoomState(currentRoomId);
  });

  socket.on('new-round', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || room.hostSocketId !== socket.id) return;
    room.revealed = false;
    for (const player of room.players.values()) { player.voted = false; player.value = null; }
    broadcastRoomState(currentRoomId);
  });

  socket.on('timer:start', ({ durationMs }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || room.hostSocketId !== socket.id) return;
    const duration = Math.min(300000, Math.max(10000, Number(durationMs) || 60000));
    if (room.timer.intervalId) clearInterval(room.timer.intervalId);
    room.timer = { intervalId: null, remaining: duration, totalDuration: duration, running: true };
    room.timer.intervalId = setInterval(() => {
      room.timer.remaining = Math.max(0, room.timer.remaining - 500);
      broadcastRoomState(currentRoomId);
      if (room.timer.remaining <= 0) {
        clearInterval(room.timer.intervalId);
        room.timer.intervalId = null;
        room.timer.running = false;
        broadcastRoomState(currentRoomId);
      }
    }, 500);
    broadcastRoomState(currentRoomId);
  });

  socket.on('timer:cancel', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.timer.intervalId) clearInterval(room.timer.intervalId);
    room.timer.intervalId = null;
    room.timer.running = false;
    broadcastRoomState(currentRoomId);
  });

  socket.on('disconnect', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    room.players.delete(socket.id);
    if (room.players.size === 0) {
      if (room.timer.intervalId) clearInterval(room.timer.intervalId);
      rooms.delete(currentRoomId);
    } else {
      if (room.hostSocketId === socket.id) {
        room.hostSocketId = room.players.keys().next().value;
      }
      broadcastRoomState(currentRoomId);
    }
  });
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

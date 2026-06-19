const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'http://localhost:3000', methods: ['GET', 'POST'] }
});

const MAX_PARTICIPANTS= 40;

// rooms Map: roomId -> { participants: Map<socketId, { name, vote }>, revealed: boolean }
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { participants: new Map(), revealed: false });
  }
  return rooms.get(roomId);
}

function roomState(room) {
  const participants = [];
  room.participants.forEach((v, k) => {
    participants.push({
      id: k,
      name: v.name,
      vote: room.revealed ? v.vote : (v.vote !== null ? '?' : null)
    });
  });
  return { participants, revealed: room.revealed };
}

io.on('connection', (socket) => {
  console.log('Connected: ' + socket.id);

  socket.on('joinRoom', ({ roomId, name }, cb) => {
    const room = getOrCreateRoom(roomId);
    if (room.participants.size >= MAX_PARTICIPANTS) {
      return cb && cb({ error: 'Room is full (max 20 participants).' });
    }
    room.participants.set(socket.id, { name, vote: null });
    socket.join(roomId);
    socket.data.roomId = roomId;
    io.to(roomId).emit('roomUpdate', roomState(room));
    cb && cb({ success: true });
  });

  socket.on('submitVote', ({ vote }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const participant = room.participants.get(socket.id);
    if (participant) participant.vote = vote;
    io.to(roomId).emit('roomUpdate', roomState(room));
  });

  socket.on('revealVotes', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (room) room.revealed = true;
    io.to(roomId).emit('roomUpdate', roomState(room));
  });

  socket.on('resetVotes', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (room) {
      room.revealed = false;
      room.participants.forEach((p) => (p.vote = null));
    }
    io.to(roomId).emit('roomUpdate', roomState(room));
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (room) {
      room.participants.delete(socket.id);
      if (room.participants.size === 0) {
        rooms.delete(roomId);
      } else {
        io.to(roomId).emit('roomUpdate', roomState(room));
      }
    }
    console.log('Disconnected: ' + socket.id);
  });
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log('Server listening on port ' + PORT));

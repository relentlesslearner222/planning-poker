const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const rooms = new Map();

function createRoom() {
  return {
    participants: [],
    votes: {},
    revealed: false,
    hostId: null,
    timer: {
      state: 'idle',
      duration: 60,
      remaining: 60,
      intervalId: null
    }
  };
}

function roomPayload(room) {
  return {
    participants: room.participants,
    votes: room.votes,
    revealed: room.revealed,
    hostId: room.hostId,
    timer: {
      state: room.timer.state,
      duration: room.timer.duration,
      remaining: room.timer.remaining
    }
  };
}

function stopTimer(room) {
  if (room.timer.intervalId) {
    clearInterval(room.timer.intervalId);
    room.timer.intervalId = null;
  }
}

function revealVotes(room, roomId) {
  room.revealed = true;
  stopTimer(room);
  room.timer.state = 'idle';
  io.to(roomId).emit('roomUpdate', roomPayload(room));
}

function allVoted(room) {
  const ids = room.participants.map(p => p.id);
  return ids.length > 0 && ids.every(id => room.votes[id] !== undefined);
}

function startInterval(room, roomId) {
  if (room.timer.intervalId) clearInterval(room.timer.intervalId);
  room.timer.state = 'running';
  room.timer.intervalId = setInterval(() => {
    room.timer.remaining -= 1;
    if (room.timer.remaining <= 0) {
      room.timer.remaining = 0;
      clearInterval(room.timer.intervalId);
      room.timer.intervalId = null;
      revealVotes(room, roomId);
      return;
    }
    io.to(roomId).emit('roomUpdate', roomPayload(room));
  }, 1000);
}

function reassignHost(room) {
  room.hostId = room.participants.length > 0 ? room.participants[0].id : null;
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('joinRoom', ({ roomId, name }) => {
    if (!rooms.has(roomId)) rooms.set(roomId, createRoom());
    const room = rooms.get(roomId);
    const isFirst = room.participants.length === 0;
    room.participants.push({ id: socket.id, name });
    if (isFirst) room.hostId = socket.id;
    socket.join(roomId);
    socket.data.roomId = roomId;
    io.to(roomId).emit('roomUpdate', roomPayload(room));
  });

  socket.on('submitVote', ({ roomId, vote }) => {
    const room = rooms.get(roomId);
    if (!room || room.revealed) return;
    room.votes[socket.id] = vote;
    io.to(roomId).emit('roomUpdate', roomPayload(room));
    if (allVoted(room)) revealVotes(room, roomId);
  });

  socket.on('revealVotes', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    revealVotes(room, roomId);
  });

  socket.on('resetRound', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    stopTimer(room);
    room.votes = {};
    room.revealed = false;
    room.timer.remaining = room.timer.duration;
    room.timer.state = 'idle';
    io.to(roomId).emit('roomUpdate', roomPayload(room));
  });

  socket.on('setTimerDuration', ({ roomId, duration }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId) return;
    const d = Math.max(10, Math.min(300, Number(duration)));
    stopTimer(room);
    room.timer.duration = d;
    room.timer.remaining = d;
    room.timer.state = 'idle';
    io.to(roomId).emit('roomUpdate', roomPayload(room));
  });

  socket.on('startTimer', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId || room.timer.state === 'running') return;
    if (room.timer.state === 'idle') room.timer.remaining = room.timer.duration;
    startInterval(room, roomId);
    io.to(roomId).emit('roomUpdate', roomPayload(room));
  });

  socket.on('pauseTimer', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId || room.timer.state !== 'running') return;
    clearInterval(room.timer.intervalId);
    room.timer.intervalId = null;
    room.timer.state = 'paused';
    io.to(roomId).emit('roomUpdate', roomPayload(room));
  });

  socket.on('resumeTimer', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId || room.timer.state !== 'paused') return;
    startInterval(room, roomId);
    io.to(roomId).emit('roomUpdate', roomPayload(room));
  });

  socket.on('resetTimer', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId) return;
    stopTimer(room);
    room.timer.remaining = room.timer.duration;
    room.timer.state = 'idle';
    io.to(roomId).emit('roomUpdate', roomPayload(room));
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.participants = room.participants.filter(p => p.id !== socket.id);
    delete room.votes[socket.id];
    if (room.hostId === socket.id) {
      reassignHost(room);
      if (!room.hostId) { stopTimer(room); rooms.delete(roomId); return; }
    }
    io.to(roomId).emit('roomUpdate', roomPayload(room));
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
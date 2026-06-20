// server/index.js – Planning Poker with server-synchronized timer (issue #10)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(express.static(path.join(__dirname, '../client/build')));
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, '../client/build/index.html'))
);

/**
 * rooms: Map<roomId, {
 *   hostSocketId: string | null,
 *   members: string[],
 *   votes: Map<socketId, value>,
 *   revealed: boolean,
 *   timerDuration: number,
 *   timerRemaining: number,
 *   timerStatus: 'idle'|'running'|'paused'|'finished',
 *   timerInterval: NodeJS.Timeout | null,
 * }>
 */
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      hostSocketId: null,
      members: [],
      votes: new Map(),
      revealed: false,
      timerDuration: 60,
      timerRemaining: 60,
      timerStatus: 'idle',
      timerInterval: null,
    });
  }
  return rooms.get(roomId);
}

function clearRoomTimer(room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
}

function finishTimer(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  clearRoomTimer(room);
  room.timerStatus = 'finished';
  room.timerRemaining = 0;
  io.to(roomId).emit('timer:finished', { remaining: 0 });
  if (!room.revealed) {
    room.revealed = true;
    const votesObj = Object.fromEntries(room.votes);
    io.to(roomId).emit('timer:revealed', { votes: votesObj });
  }
}

function startInterval(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  clearRoomTimer(room);
  room.timerStatus = 'running';
  room.timerInterval = setInterval(() => {
    const r = rooms.get(roomId);
    if (!r || r.timerStatus !== 'running') return;
    r.timerRemaining = Math.max(0, r.timerRemaining - 1);
    io.to(roomId).emit('timer:tick', { remaining: r.timerRemaining, status: r.timerStatus });
    if (r.timerRemaining <= 0) finishTimer(roomId);
  }, 1000);
}

function checkAllVoted(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.revealed || room.timerStatus === 'finished') return;
  if (room.members.length === 0) return;
  const allVoted = room.members.every((id) => room.votes.has(id));
  if (allVoted) finishTimer(roomId);
}

io( on('connection', (socket) => {
  let currentRoom = null;

  socket.on('join-room', ({ roomId, name }) => {
    currentRoom = roomId;
    socket.join(roomId);
    const room = getOrCreateRoom(roomId);
    if (room.members.length === 0) room.hostSocketId = socket.id;
    if (!room.members.includes(socket.id)) room.members.push(socket.id);
    socket.emit('room:state', {
      hostSocketId: room.hostSocketId,
      votes: Object.fromEntries(room.votes),
      revealed: room.revealed,
      timerDuration: room.timerDuration,
      timerRemaining: room.timerRemaining,
      timerStatus: room.timerStatus,
    });
    socket.to(roomId).emit('user:joined', { socketId: socket.id, name });
  });

  socket.on('vote', ({ roomId, value }) => {
    const room = rooms.get(roomId);
    if (!room || room.revealed || room.timerStatus === 'finished') return;
    room.votes.set(socket.id, value);
    io.to(roomId).emit('vote:cast', { socketId: socket.id });
    checkAllVoted(roomId);
  });

  socket.on('timer:configure', ({ roomId, duration }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.timerStatus === 'running') return;
    const secs = Math.min(300, Math.max(10, parseInt(duration, 10) || 60));
    room.timerDuration = secs;
    room.timerRemaining = secs;
    room.timerStatus = 'idle';
    io.to(roomId).emit('timer:tick', { remaining: room.timerRemaining, status: room.timerStatus });
  });

  socket.on('timer:start', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.timerStatus === 'running' || room.timerStatus === 'finished') return;
    startInterval(roomId);
    io.to(roomId).emit('timer:tick', { remaining: room.timerRemaining, status: room.timerStatus });
  });

  socket.on('timer:pause', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.timerStatus !== 'running') return;
    clearRoomTimer(room);
    room.timerStatus = 'paused';
    io.to(roomId).emit('timer:tick', { remaining: room.timerRemaining, status: room.timerStatus });
  });

  socket.on('timer:reset', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostSocketId !== socket.id) return;
    clearRoomTimer(room);
    room.timerRemaining = room.timerDuration;
    room.timerStatus = 'idle';
    room.revealed = false;
    room.votes.clear();
    io.to(roomId).emit('timer:tick', { remaining: room.timerRemaining, status: room.timerStatus });
    io.to(roomId).emit('votes:reset');
  });

  socket.on('disconnect', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    room.members = room.members.filter((id) => id !== socket.id);
    room.votes.delete(socket.id);
    if (room.members.length === 0) {
      clearRoomTimer(room);
      rooms.delete(currentRoom);
      return;
    }
    if (room.hostSocketId === socket.id) {
      room.hostSocketId = room.members[0];
      io.to(currentRoom).emit('host:changed', { hostSocketId: room.hostSocketId });
    }
    io.to(currentRoom).emit('user:left', { socketId: socket.id });
    checkAllVoted(currentRoom);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
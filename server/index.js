// server/index.js  --  Planning Poker backend with server-synchronised timer
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ----------------------------------------------------------------
// rooms[roomId] = {
//   hostId   : string,
//   members  : string[],
//   votes    : { [socketId]: value },
//   revealed : boolean,
//   timer    : { status, duration, startTime, remaining, interval }
// }
const rooms = {};

function getOrCreateRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      hostId  : null,
      members : [],
      votes   : {},
      revealed: false,
      timer   : {
        status   : 'idle',
        duration : 60000,
        startTime: null,
        remaining: 60000,
        interval : null,
      },
    };
  }
  return rooms[roomId];
}

const msToSec = (ms) => Math.max(0, Math.ceil(ms / 1000));

function emitTimerUpdate(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  const t = room.timer;
  let remaining = (t.status === 'running')
    ? t.remaining - (Date.now() - t.startTime)
    : t.remaining;
  remaining = Math.max(0, remaining);
  io.to(roomId).emit('timer:update', {
    status          : t.status,
    remainingSeconds: msToSec(remaining),
    duration        : t.duration,
    hostId          : room.hostId,
  });
}

function clearTimerInterval(room) {
  if (room.timer.interval) {
    clearInterval(room.timer.interval);
    room.timer.interval = null;
  }
}

function revealVotes(roomId) {
  const room = rooms[roomId];
  if (!room || room.revealed) return;
  room.revealed = true;
  clearTimerInterval(room);
  room.timer.status = 'expired';
  io.to(roomId).emit('votes:reveal', { votes: room.votes });
  emitTimerUpdate(roomId);
}

function checkAllVoted(roomId) {
  const room = rooms[roomId];
  if (!room || room.revealed) return;
  const allVoted = room.members.every((id) => room.votes[id] !== undefined);
  if (allVoted && room.members.length > 0) revealVotes(roomId);
}

function startTimerInterval(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  clearTimerInterval(room);
  room.timer.interval = setInterval(() => {
    const t       = room.timer;
    const elapsed  = Date.now() - t.startTime;
    const left     = t.remaining - elapsed;
    emitTimerUpdate(roomId);
    if (left <= 0) {
      clearTimerInterval(room);
      t.status    = 'expired';
      t.remaining = 0;
      io.to(roomId).emit('timer:expired');
      revealVotes(roomId);
    }
  }, 1000);
}

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on('join:room', ({ roomId, username }) => {
    socket.join(roomId);
    const room = getOrCreateRoom(roomId);
    room.members.push(socket.id);
    socket.data.roomId   = roomId;
    socket.data.username = username;
    if (!room.hostId) room.hostId = socket.id;
    socket.emit('room:joined', {
      hostId  : room.hostId,
      votes   : room.revealed ? room.votes : null,
      revealed: room.revealed,
      timer   : { status: room.timer.status, remainingSeconds: msToSec(room.timer.remaining), duration: room.timer.duration },
    });
    io.to(roomId).emit('room:members', { members: room.members, hostId: room.hostId });
  });

  socket.on('vote:submit', ({ roomId, value }) => {
    const room = rooms[roomId];
    if (!room || room.revealed) return;
    room.votes[socket.id] = value;
    io.to(roomId).emit('vote:received', { socketId: socket.id });
    checkAllVoted(roomId);
  });

  socket.on('timer:configure', ({ roomId, durationSeconds }) => {
    const room = rooms[roomId];
    if (!room || room.hostId === socket.id === false) return;
    if (room.timer.status === 'running') return;
    const ms = Math.max(5, Math.min(600, durationSeconds)) * 1000;
    room.timer.duration  = ms;
    room.timer.remaining = ms;
    emitTimerUpdate(roomId);
  });

  socket.on('timer:start', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id) return;
    if (room.timer.status === 'running') return;
    room.timer.startTime = Date.now();
    room.timer.status    = 'running';
    startTimerInterval(roomId);
    emitTimerUpdate(roomId);
  });

  socket.on('timer:pause', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id) return;
    if (room.timer.status !== 'running') return;
    room.timer.remaining = Math.max(0, room.timer.remaining - (Date.now() - room.timer.startTime));
    room.timer.status    = 'paused';
    clearTimerInterval(room);
    emitTimerUpdate(roomId);
  });

  socket.on('timer:reset', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id) return;
    clearTimerInterval(room);
    room.timer.status    = 'idle';
    room.timer.startTime = null;
    room.timer.remaining = room.timer.duration;
    room.votes    = {};
    room.revealed = false;
    io.to(roomId).emit('votes:reset');
    emitTimerUpdate(roomId);
  });

  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms[roomId];
    if (!room) return;
    room.members = room.members.filter((id) => id !== socket.id);
    delete room.votes[socket.id];
    if (room.hostId === socket.id) room.hostId = room.members[0] ?? null;
    if (room.members.length === 0) { clearTimerInterval(room); delete rooms[roomId]; return; }
    io.to(roomId).emit('room:members', { members: room.members, hostId: room.hostId });
    checkAllVoted(roomId);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server listening on :${PORT}`));
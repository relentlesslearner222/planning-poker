const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// rooms: Map<roomId, RoomState>
// RoomState = {
//   participants: Map<socketId, { name, vote }>,
//   joinOrder: string[],           // socketIds in join order -- first = host
//   hostId: string,
//   revealed: boolean,
//   timer: {
//     duration: number,            // configured seconds (default 60)
//     remaining: number,
//     state: 'idle' | 'running' | 'paused' | 'expired',
//     intervalRef: NodeJS.Timer | null,
//   }
// }

const rooms = new Map();

function makeRoom() {
  return {
    participants: new Map(),
    joinOrder: [],
    hostId: null,
    revealed: false,
    timer: {
      duration: 60,
      remaining: 60,
      state: 'idle',
      intervalRef: null,
    },
  };
}

function getRoomSnapshot(room) {
  const participants = [];
  for (const [id, p] of room.participants) {
    participants.push({ id, name: p.name, hasVoted: p.vote !== null });
  }
  return {
    participants,
    hostId: room.hostId,
    revealed: room.revealed,
    votes: room.revealed
      ? Object.fromEntries(
          [...room.participants.entries()].map(([id, p]) => [id, p.vote])
        )
      : null,
    timer: {
      duration: room.timer.duration,
      remaining: room.timer.remaining,
      state: room.timer.state,
    },
  };
}

function broadcastRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  io.to(roomId).emit('roomUpdate', getRoomSnapshot(room));
}

function stopTimer(room) {
  if (room.timer.intervalRef) {
    clearInterval(room.timer.intervalRef);
    room.timer.intervalRef = null;
  }
}

function revealVotes(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  stopTimer(room);
  room.timer.state = 'expired';
  room.revealed = true;
  broadcastRoom(roomId);
}

function checkAllVoted(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.revealed) return;
  const participants = [...room.participants.values()];
  if (participants.length > 0 && participants.every((p) => p.vote !== null)) {
    revealVotes(roomId);
  }
}

function startCountdown(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  stopTimer(room);
  room.timer.state = 'running';

  room.timer.intervalRef = setInterval(() => {
    const r = rooms.get(roomId);
    if (!r) { return; }
    r.timer.remaining -= 1;
    if (r.timer.remaining <= 0) {
      r.timer.remaining = 0;
      revealVotes(roomId);
    } else {
      broadcastRoom(roomId);
    }
  }, 1000);
}

io.on('connection', (socket) => {
  console.log('connect', socket.id);

  socket.on('joinRoom', ({ roomId, name }) => {
    if (!rooms.has(roomId)) rooms.set(roomId, makeRoom());
    const room = rooms.get(roomId);
    room.participants.set(socket.id, { name, vote: null });
    room.joinOrder.push(socket.id);
    if (!room.hostId) room.hostId = socket.id;
    socket.join(roomId);
    socket.data.roomId = roomId;
    broadcastRoom(roomId);
  });

  socket.on('submitVote', ({ roomId, vote }) => {
    const room = rooms.get(roomId);
    if (!room || room.revealed) return;
    const participant = room.participants.get(socket.id);
    if (!participant) return;
    participant.vote = vote;
    broadcastRoom(roomId);
    checkAllVoted(roomId);
  });

  socket.on('revealVotes', ({ roomId }) => {
    revealVotes(roomId);
  });

  socket.on('resetRoom', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    stopTimer(room);
    for (const p of room.participants.values()) p.vote = null;
    room.revealed = false;
    room.timer.remaining = room.timer.duration;
    room.timer.state = 'idle';
    broadcastRoom(roomId);
  });

  socket.on('timerConfig', ({ roomId, duration }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    const d = Math.min(300, Math.max(10, Number(duration)));
    stopTimer(room);
    room.timer.duration = d;
    room.timer.remaining = d;
    room.timer.state = 'idle';
    broadcastRoom(roomId);
  });

  socket.on('timerStart', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    if (room.timer.state === 'running') return;
    if (room.timer.remaining <= 0) room.timer.remaining = room.timer.duration;
    startCountdown(roomId);
    broadcastRoom(roomId);
  });

  socket.on('timerPause', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    if (room.timer.state !== 'running') return;
    stopTimer(room);
    room.timer.state = 'paused';
    broadcastRoom(roomId);
  });

  socket.on('timerResume', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId === socket.id === false) return;
    if (room.timer.state !== 'paused') return;
    startCountdown(roomId);
    broadcastRoom(roomId);
  });

  socket.on('timerReset', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    stopTimer(room);
    room.timer.remaining = room.timer.duration;
    room.timer.state = 'idle';
    broadcastRoom(roomId);
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.participants.delete(socket.id);
    room.joinOrder = room.joinOrder.filter((id) => id !== socket.id);
    if (room.hostId === socket.id) {
      room.hostId = room.joinOrder[0] ?? null;
    }
    if (room.participants.size === 0) {
      stopTimer(room);
      rooms.delete(roomId);
    } else {
      broadcastRoom(roomId);
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server listening on :${PORT}`));
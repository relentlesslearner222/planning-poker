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

// rooms Map each entry:
// {
//   participants: [ { id, name, vote } ],   // ordered by join time (oldest first)
//   hostId: string,
//   revealed: boolean,
//   votingLocked: boolean,
//   timer: {
//     duration: number,   // seconds configured by host (default 60)
//     remaining: number,  // seconds left
//     status: 'idle' | 'running' | 'paused',
//     intervalRef: nodeRef | null,
//   }
// }
const rooms = new Map();

// helpers

function getRoomState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  return {
    participants: room.participants,
    hostId: room.hostId,
    revealed: room.revealed,
    votingLocked: room.votingLocked,
    timer: {
      duration: room.timer.duration,
      remaining: room.timer.remaining,
      status: room.timer.status,
    },
  };
}

function broadcastRoom(roomId) {
  const state = getRoomState(roomId);
  if (state) io.to(roomId).emit('roomUpdate', state);
}

function clearTimer(room) {
  if (room.timer.intervalRef) {
    clearInterval(room.timer.intervalRef);
    room.timer.intervalRef = null;
  }
}

function autoReveal(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  clearTimer(room);
  room.timer.status = 'idle';
  room.timer.remaining = 0;
  room.votingLocked = true;
  room.revealed = true;
  broadcastRoom(roomId);
}

function startServerTimer(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  clearTimer(room);

  room.timer.intervalRef = setInterval(() => {
    const r = rooms.get(roomId);
    if (!r) return;

    r.timer.remaining -= 1;

    io.to(roomId).emit('timerTick', {
      remaining: r.timer.remaining,
      status: r.timer.status,
    });

    if (r.timer.remaining <= 0) {
      autoReveal(roomId);
    }
  }, 1000);
}

function checkAllVoted(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const allVoted =
    room.participants.length > 0 &&
    room.participants.every((p) => p.vote !== null && p.vote !== undefined);
  if (allVoted && room.timer.status === 'running') {
    autoReveal(roomId);
  }
}

// socket handlers

io.on('connection', (socket) => {
  console.log('socket connected:', socket.id);

  socket.on('joinRoom', ({ roomId, name }) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        participants: [],
        hostId: socket.id,
        revealed: false,
        votingLocked: false,
        timer: {
          duration: 60,
          remaining: 60,
          status: 'idle',
          intervalRef: null,
        },
      });
    }

    const room = rooms.get(roomId);

    if (!room.participants.find((p) => p.id === socket.id)) {
      room.participants.push({ id: socket.id, name, vote: null });
    }

    socket.data.roomId = roomId;
    socket.data.name = name;

    broadcastRoom(roomId);
  });

  socket.on('submitVote', ({ roomId, vote }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.votingLocked) return;
    const participant = room.participants.find((p) => p.id === socket.id);
    if (participant) {
      participant.vote = vote;
      broadcastRoom(roomId);
      checkAllVoted(roomId);
    }
  });

  socket.on('revealVotes', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    clearTimer(room);
    room.timer.status = 'idle';
    room.revealed = true;
    room.votingLocked = true;
    broadcastRoom(roomId);
  });

  socket.on('resetRoom', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    clearTimer(room);
    room.participants.forEach((p) => (p.vote = null));
    room.revealed = false;
    room.votingLocked = false;
    room.timer.remaining = room.timer.duration;
    room.timer.status = 'idle';
    broadcastRoom(roomId);
  });

  socket.on('setTimerDuration', ({ roomId, duration }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId) return;
    if (room.timer.status !== 'idle') return;
    const clamped = Math.min(300, Math.max(10, Number(duration)));
    room.timer.duration = clamped;
    room.timer.remaining = clamped;
    broadcastRoom(roomId);
  });

  socket.on('startTimer', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId) return;
    if (room.timer.status === 'running') return;
    if (room.timer.status === 'idle') {
      room.timer.remaining = room.timer.duration;
    }
    room.timer.status = 'running';
    room.votingLocked = false;
    startServerTimer(roomId);
    broadcastRoom(roomId);
  });

  socket.on('pauseTimer', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId) return;
    if (room.timer.status !== 'running') return;
    clearTimer(room);
    room.timer.status = 'paused';
    broadcastRoom(roomId);
  });

  socket.on('resumeTimer', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId) return;
    if (room.timer.status !== 'paused') return;
    room.timer.status = 'running';
    startServerTimer(roomId);
    broadcastRoom(roomId);
  });

  socket.on('resetTimer', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId) return;
    clearTimer(room);
    room.timer.remaining = room.timer.duration;
    room.timer.status = 'idle';
    broadcastRoom(roomId);
  });

  socket.on('disconnect', () => {
    console.log('socket disconnected:', socket.id);
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.participants = room.participants.filter((p) => p.id !== socket.id);
    if (room.participants.length === 0) {
      clearTimer(room);
      rooms.delete(roomId);
      return;
    }
    if (room.hostId === socket.id) {
      room.hostId = room.participants[0].id;
      console.log(`host promoted to ${room.hostId} in room ${roomId}`);
    }
    broadcastRoom(roomId);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
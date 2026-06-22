const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

/**
 * Room structure:
 * {
 *   id: string,
 *   name: string,
 *   host: socketId,
 *   participants: [{ id, name, vote: null|number, hasVoted: bool }],
 *   timerDuration: number (seconds),
 *   timerRemaining: number,
 *   timerInterval: NodeJS Interval,
 *   timerRunning: bool,
 *   votesRevealed: bool,
 *   currentTopic: string
 * }
 */
const rooms = new Map();

// --- Helpers ---
function getRoomState(room) {
  return {
    id: room.id,
    name: room.name,
    host: room.host,
    participants: room.participants.map((p) => ({
      id: p.id,
      name: p.name,
      hasVoted: p.hasVoted,
      vote: room.votesRevealed ? p.vote : null
    })),
    timerDuration: room.timerDuration,
    timerRemaining: room.timerRemaining,
    timerRunning: room.timerRunning,
    votesRevealed: room.votesRevealed,
    currentTopic: room.currentTopic
  };
}

function startTimer(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.timerRunning) return;

  room.timerRunning = true;
  room.timerInterval = setInterval(() => {
    const r = rooms.get(roomId);
    if (!r) return;

    if (r.timerRemaining <= 0) {
      clearInterval(r.timerInterval);
      r.timerRunning = false;
      r.votesRevealed = true;
      io.to(roomId).emit('timer-expired', getRoomState(r));
    } else {
      r.timerRemaining -= 1;
      io.to(roomId).emit('timer-tick', {
        timerRemaining: r.timerRemaining,
        timerRunning: r.timerRunning
      });
    }
  }, 1000);
}

function stopTimer(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  clearInterval(room.timerInterval);
  room.timerRunning = false;
}

function resetRoom(room) {
  stopTimer(room.id);
  room.votesRevealed = false;
  room.timerRemaining = room.timerDuration;
  room.participants = room.participants.map((p) => ({
    ...p,
    vote: null,
    hasVoted: false
  }));
}

// --- Socket events ---
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Create a new room
  socket.on('create-room', ({ name, userName, timerDuration = 60 }) => {
    const roomId = uuidv4().substring(0, 8).toUpperCase();
    const room = {
      id: roomId,
      name: name || `Room ${roomId}`,
      host: socket.id,
      participants: [{ id: socket.id, name: userName, vote: null, hasVoted: false }],
      timerDuration: Number(timerDuration),
      timerRemaining: Number(timerDuration),
      timerInterval: null,
      timerRunning: false,
      votesRevealed: false,
      currentTopic: ''
    };
    rooms.set(roomId, room);
    socket.join(roomId);
    socket.emit('room-created', { roomId, roomState: getRoomState(room) });
  });

  // Join an existing room
  socket.on('join-room', ({ roomId, userName }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    const existing = room.participants.find((p) => p.id === socket.id);
    if (!existing) {
      room.participants.push({ id: socket.id, name: userName, vote: null, hasVoted: false });
    }
    socket.join(roomId);
    io.to(roomId).emit('room-updated', getRoomState(room));
    socket.emit('joined-room', { roomId, roomState: getRoomState(room) });
  });

  // Submit a vote
  socket.on('submit-vote', ({ roomId, vote }) => {
    const room = rooms.get(roomId);
    if (!room || room.votesRevealed) return;
    const participant = room.participants.find((p) => p.id === socket.id);
    if (!participant) return;
    participant.vote = vote;
    participant.hasVoted = true;
    io.to(roomId).emit('room-updated', getRoomState(room));
    // Auto-reveal when everyone has voted
    const allVoted = room.participants.every((p) => p.hasVoted);
    if (allVoted) {
      stopTimer(roomId);
      room.votesRevealed = true;
      io.to(roomId).emit('votes-revealed', getRoomState(room));
    }
  });

  // Host: start timer
  socket.on('start-timer', ({ roomId, topic }) => {
    const room = rooms.get(roomId);
    if (!room || room.host !== socket.id) return;
    if (topic) room.currentTopic = topic;
    resetRoom(room);
    startTimer(roomId);
    io.to(roomId).emit('timer-started', getRoomState(room));
  });

  // Host: pause timer
  socket.on('pause-timer', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.host !== socket.id) return;
    stopTimer(roomId);
    io.to(roomId).emit('timer-paused', { timerRemaining: room.timerRemaining, timerRunning: false });
  });

  // Host: resume timer
  socket.on('resume-timer', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.host !== socket.id) return;
    startTimer(roomId);
    io.to(roomId).emit('timer-resumed', { timerRemaining: room.timerRemaining, timerRunning: true });
  });

  // Host: manually reveal votes
  socket.on('reveal-votes', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.host !== socket.id) return;
    stopTimer(roomId);
    room.votesRevealed = true;
    io.to(roomId).emit('votes-revealed', getRoomState(room));
  });

  // Host: reset round
  socket.on('reset-round', ({ roomId, timerDuration }) => {
    const room = rooms.get(roomId);
    if (!room || room.host !== socket.id) return;
    if (timerDuration) {
      room.timerDuration = Number(timerDuration);
    }
    resetRoom(room);
    io.to(roomId).emit('room-updated', getRoomState(room));
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    for (const [roomId, room] of rooms) {
      const index = room.participants.findIndex((p) => p.id === socket.id);
      if (index !== -1) {
        room.participants.splice(index, 1);
        if (room.participants.length === 0) {
          stopTimer(roomId);
          rooms.delete(roomId);
        } else {
          if (room.host === socket.id) {
            room.host = room.participants[0].id;
          }
          io.to(roomId).emit('room-updated', getRoomState(room));
        }
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

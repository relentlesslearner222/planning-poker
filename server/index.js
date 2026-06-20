const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// In-memory room state
// rooms[roomId] = {
//   hostId: socketId,
//   members: Map<socketId, { name }>,
//   votes: Map<socketId, value>,
//   revealed: boolean,
//   timer: {
//     durationSeconds: number,
//     remainingSeconds: number,
//     running: boolean,
//     paused: boolean,
//     intervalId: NodeJS timer | null,
//   }
// }
const rooms = {};

function getOrCreateRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      hostId: null,
      members: new Map(),
      votes: new Map(),
      revealed: false,
      timer: {
        durationSeconds: 60,
        remainingSeconds: 60,
        running: false,
        paused: false,
        intervalId: null,
      },
    };
  }
  return rooms[roomId];
}

function getRoomState(room) {
  return {
    hostId: room.hostId,
    members: Array.from(room.members.entries()).map(([id, data]) => ({
      socketId: id,
      name: data.name,
    })),
    votes: room.revealed
      ? Object.fromEntries(room.votes)
      : Object.fromEntries(
          Array.from(room.votes.keys()).map((k) => [k, '?'])
        ),
    revealed: room.revealed,
  };
}

function getTimerState(room) {
  return {
    durationSeconds: room.timer.durationSeconds,
    remainingSeconds: room.timer.remainingSeconds,
    running: room.timer.running,
    paused: room.timer.paused,
  };
}

function stopTimer(room) {
  if (room.timer.intervalId) {
    clearInterval(room.timer.intervalId);
    room.timer.intervalId = null;
  }
  room.timer.running = false;
}

// ✅ CORRECT -- `io` is the Socket.io server instance
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // 84 join-room -------------------------------------------------------
  socket.on('j-room', ({ roomId, playerName }) => {
    if (!roomId || !playerName) return;

    const room = getOrCreateRoom(roomId);

    // First member becomes the host
    if (room.members.size === 0) {
      room.hostId = socket.id;
    }

    room.members.set(socket.id, { name: playerName });
    socket.join(roomId);
    socket.data.roomId = roomId;

    // Send full state to the joining client
    socket.emit('room-state', getRoomState(room));
    socket.emit('timer:updated', getTimerState(room));

    // Notify others
    io.to(roomId).emit('room-state', getRoomState(room));
    console.log(`${playerName} joined room ${roomId}`);
  });

  socket.on('join-room', ({ roomId, playerName }) => {
    if (!roomId || !playerName) return;

    const room = getOrCreateRoom(roomId);

    // First member becomes the host
    if (room.members.size === 0) {
      room.hostId = socket.id;
    }

    room.members.set(socket.id, { name: playerName });
    socket.join(roomId);
    socket.data.roomId = roomId;

    socket.emit('room-state', getRoomState(room));
    socket.emit('timer:updated', getTimerState(room));

    io.to(roomId).emit('room-state', getRoomState(room));
    console.log(`${playerName} joined room ${roomId}`);
  });

  // ── vote ---------------------------------------------------------
  socket.on('submit-vote', ({ roomId, vote }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.votes.set(socket.id, vote);
    io.to(roomId).emit('room-state', getRoomState(room));
  });

  // ── reveal ---------------------------------------------------------
  socket.on('reveal-votes', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.hostId) return;

    room.revealed = true;
    io.to(roomId).emit('room-state', getRoomState(room));
  });

  // 84 reset ------------------------------------------------------------
  socket.on('reset-game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.hostId) return;

    room.votes.clear();
    room.revealed = false;
    io.to(roomId).emit('room-state', getRoomState(room));
  });

  // ── timer:configure -------------------------------------------------
  // Payload: { roomId, durationSeconds }  (per SOCKET_EVENTS.md)
  socket.on('timer:configure', ({ roomId, durationSeconds }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.hostId) return;
    if (room.timer.running) return; // ignored while running

    const clamped = Math.min(600, Math.max(60, Number(durationSeconds)));
    room.timer.durationSeconds = clamped;
    room.timer.remainingSeconds = clamped;

    io.to(roomId).emit('timer:updated', getTimerState(room));
  });

  // ── timer:start -----------------------------------------------------
  socket.on('timer:start', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.hostId) return;
    if (room.timer.running) return;

    room.timer.running = true;
    room.timer.paused = false;

    room.timer.intervalId = setInterval(() => {
      room.timer.remainingSeconds -= 1;

      io.to(roomId).emit('timer:tick', {
        remainingSeconds: room.timer.remainingSeconds,
        running: room.timer.running,
      });

      if (room.timer.remainingSeconds <= 0) {
        stopTimer(room);
        room.revealed = true;
        io.to(roomId).emit('timer:expired');
        io.to(roomId).emit('room-state', getRoomState(room));
      }
    }, 1000);

    io.to(roomId).emit('timer:updated', getTimerState(room));
  });

  // ── timer:pause -----------------------------------------------------
  socket.on('timer:pause', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.hostId) return;
    if (!room.timer.running) return;

    stopTimer(room);
    room.timer.paused = true;

    io.to(roomId).emit('timer:updated', getTimerState(room));
  });

  // ── timer:resume ----------------------------------------------------
  socket.on('timer:resume', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.hostId) return;
    if (room.timer.running || !room.timer.paused) return;

    room.timer.running = true;
    room.timer.paused = false;

    room.timer.intervalId = setInterval(() => {
      room.timer.remainingSeconds -= 1;

      io.to(roomId).emit('timer:tick', {
        remainingSeconds: room.timer.remainingSeconds,
        running: room.timer.running,
      });

      if (room.timer.remainingSeconds <= 0) {
        stopTimer(room);
        room.revealed = true;
        io.to(roomId).emit('timer:expired');
        io.to(roomId).emit('room-state', getRoomState(room));
      }
    }, 1000);

    io.to(roomId).emit('timer:updated', getTimerState(room));
  });

  // ── timer:reset -----------------------------------------------------
  socket.on('timer:reset', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.hostId) return;

    stopTimer(room);
    room.timer.paused = false;
    room.timer.remainingSeconds = room.timer.durationSeconds;

    io.to(roomId).emit('timer:updated', getTimerState(room));
  });

  // 84 disconnect -------------------------------------------------------
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms[roomId];
    if (!room) return;

    room.members.delete(socket.id);
    room.votes.delete(socket.id);

    // Promote next oldest member as host if the host left
    if (room.hostId === socket.id) {
      const nextHost = room.members.keys().next().value;
      room.hostId = nextHost || null;
    }

    if (room.members.size === 0) {
      stopTimer(room);
      delete rooms[roomId];
      return;
    }

    io.to(roomId).emit('room-state', getRoomState(room));
    console.log(`Socket ${socket.id} left room ${roomId}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = { app, server };
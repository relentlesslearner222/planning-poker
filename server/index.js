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

// â”€ In-memory room state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// rooms[roomId] = {
//   hostId        : string,
//   members       : Map<socketId, { name: string }>,
//   votes         : Map<socketId, string | null>,
//   revealed      : boolean,
//   timer         : {
//     durationSeconds : number,
//     remainingSeconds: number,
//     running         : boolean,
//     paused          : boolean,
//     intervalId      : NodeJS.Timeout | null,
//   },
// }
const rooms = {};

// â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getRoom(roomId) {
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

function getRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) return null;
  return {
    hostId: room.hostId,
    members: Array.from(room.members.entries()).map(([id, data]) => ({
      id,
      name: data.name,
    })),
    votes: room.revealed
      ? Object.fromEntries(room.votes)
      : Object.fromEntries(
          Array.from(room.votes.entries()).map(([id, v]) => [
            id,
            v !== null ? 'âœ“': null,
          ])
        ),
    revealed: room.revealed,
    timer: {
      durationSeconds: room.timer.durationSeconds,
      remainingSeconds: room.timer.remainingSeconds,
      running: room.timer.running,
      paused: room.timer.paused,
    },
  };
}

function stopTimer(room) {
  if (room.timer.intervalId) {
    clearInterval(room.timer.intervalId);
    room.timer.intervalId = null;
  }
  room.timer.running = false;
}

function promoteNewHost(roomId) {
  const room = rooms[roomId];
  if (!room || room.members.size === 0) return;
  const nextHostId = room.members.keys().next().value;
  room.hostId = nextHostId;
  io.to(roomId).emit('room:updated', getRoomState(roomId));
}

// â”€ REST health-check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/health', (_req, res) => res.json({ ok: true }));

// â”€ Socket.io â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// FIX #1 (Blocker): was `ie.on('connection', ...)` â€” `ie` is undefined;
// corrected to `io.on('connection', ...)`.
io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  // â”’ join:room â”â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  socket.on('join:room', ({ roomId, name }) => {
    if (!roomId || !name) return;
    const room = getRoom(roomId);

    socket.join(roomId);
    room.members.set(socket.id, { name });
    room.votes.set(socket.id, null);

    // First member becomes host
    if (!room.hostId) {
      room.hostId = socket.id;
    }

    // Send full timer state to the joining client
    socket.emit('timer:updated', {
      durationSeconds: room.timer.durationSeconds,
      remainingSeconds: room.timer.remainingSeconds,
      running: room.timer.running,
      paused: room.timer.paused,
    });

    io.to(roomId).emit('room:updated', getRoomState(roomId));
    console.log(`[room] ${name} (${socket.id}) joined ${roomId}`);
  });

  // â”’ vote:cast â”â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  socket.on('vote:cast', ({ roomId, vote }) => {
    const room = rooms[roomId];
    if (!room || !room.members.has(socket.id)) return;
    if (room.revealed) return; // votes locked after reveal

    room.votes.set(socket.id, vote);
    io.to(roomId).emit('room:updated', getRoomState(roomId));
  });

  // â”’ vote:reveal â”â”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€
  socket.on('vote:reveal', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.hostId) return;

    room.revealed = true;
    stopTimer(room);
    io.to(roomId).emit('room:updated', getRoomState(roomId));
  });

  // â”’ vote:reset â”â”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€
  socket.on('vote:reset', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.hostId) return;

    room.votes.forEach((_v, id) => room.votes.set(id, null));
    room.revealed = false;

    // Also reset timer
    stopTimer(room);
    room.timer.remainingSeconds = room.timer.durationSeconds;
    room.timer.paused = false;

    io.to(roomId).emit('timer:updated', {
      durationSeconds: room.timer.durationSeconds,
      remainingSeconds: room.timer.remainingSeconds,
      running: false,
      paused: false,
    });
    io.to(roomId).emit('room:updated', getRoomState(roomId));
  });

  // â”’ timer:configure â”â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // FIX #2 (Contract mismatch): server now reads `durationSeconds` from
  // the payload, matching the SOCKET_EVENTS.md contract and what
  // TimerControls.jsx already emits. Previously the server was
  // reading the wrong key `duration`, causing all configure calls
  // to silently apply undefined.
  socket.on('timer:configure', ({ roomId, durationSeconds }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.hostId) return;
    if (room.timer.running) return; // ignored while running per spec

    const clamped = Math.min(600, Math.max(60, Number(durationSeconds)));
    room.timer.durationSeconds = clamped;
    room.timer.remainingSeconds = clamped;

    io.to(roomId).emit('timer:updated', {
      durationSeconds: room.timer.durationSeconds,
      remainingSeconds: room.timer.remainingSeconds,
      running: room.timer.running,
      paused: room.timer.paused,
    });
  });

  // â”’ timer:start â”â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        running: true,
      });

      if (room.timer.remainingSeconds <= 0) {
        stopTimer(room);
        room.revealed = true;
        io.to(roomId).emit('timer:expired');
        io.to(roomId).emit('room:updated', getRoomState(roomId));
      }
    }, 1000);

    io.to(roomId).emit('timer:updated', {
      durationSeconds: room.timer.durationSeconds,
      remainingSeconds: room.timer.remainingSeconds,
      running: true,
      paused: false,
    });
  });

  // â”’ timer:pause â”â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  socket.on('timer:pause', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.hostId) return;
    if (!room.timer.running) return;

    stopTimer(room);
    room.timer.paused = true;

    io.to(roomId).emit('timer:updated', {
      durationSeconds: room.timer.durationSeconds,
      remainingSeconds: room.timer.remainingSeconds,
      running: false,
      paused: true,
    });
  });

  // â”’ timer:resume â”â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        running: true,
      });

      if (room.timer.remainingSeconds <= 0) {
        stopTimer(room);
        room.revealed = true;
        io.to(roomId).emit('timer:expired');
        io.to(roomId).emit('room:updated', getRoomState(roomId));
      }
    }, 1000);

    io.to(roomId).emit('timer:updated', {
      durationSeconds: room.timer.durationSeconds,
      remainingSeconds: room.timer.remainingSeconds,
      running: true,
      paused: false,
    });
  });

  // â”’ timer:reset â”â”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€"”€
  socket.on('timer:reset', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.hostId) return;

    stopTimer(room);
    room.timer.remainingSeconds = room.timer.durationSeconds;
    room.timer.paused = false;

    io.to(roomId).emit('timer:updated', {
      durationSeconds: room.timer.durationSeconds,
      remainingSeconds: room.timer.remainingSeconds,
      running: false,
      paused: false,
    });
  });

  // â”’ disconnect â”â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${socket.id}`);

    for (const [roomId, room] of Object.entries(rooms)) {
      if (!room.members.has(socket.id)) continue;

      room.members.delete(socket.id);
      room.votes.delete(socket.id);

      if (room.members.size === 0) {
        // Empty room â€” clean up timer and remove room
        stopTimer(room);
        delete rooms[roomId];
        continue;
      }

      // Promote a new host if the host left
      if (room.hostId === socket.id) {
        promoteNewHost(roomId);
      } else {
        io.to(roomId).emit('room:updated', getRoomState(roomId));
      }
    }
  });
});

// â”€ Start â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
});

module.exports = { app, server, io };
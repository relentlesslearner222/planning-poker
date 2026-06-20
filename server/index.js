/**
 * server/index.js
 * Socket.io event handlers for Planning Poker - timer feature (issue #10)
 *
 * Socket event contract (per spec):
 *   Client -> Server:  timer:start   { duration: number }
 *   Client -> Server:  timer:pause   null
 *   Client -> Server:  timer:reset   null
 *   Client -> Server:  room:join     { roomId: string }
 *   Client -> Server:  vote:cast     { roomId: string, value: any }
 *
 *   Server -> Room:    timer:tick    { remaining: number, total: number, isRunning: boolean }
 *   Server -> Room:    timer:stopped  { reason: 'manual' | 'expired' | 'all_voted' }
 *   Server -> Room:    votes:roveal   { votes: Record<socketId, value> }
 *   Server -> Room:    host:changed  { newHostSocketId: string }
 *   Server -> Socket:  room:joined   { roomId: string, isHost: boolean }
 */

const http = require('http');
const { Server } = require('socket.io');
const {
  joinRoom,
  leaveRoom,
  clearRoomTimer,
  resetTimer,
  castVote,
  allVotesCast,
  getRoom,
  isHost,
} = require('./roomManager');

const PORT = process.env.PORT || 3001;

// ------------------------------------------------------------------------
// Bootstrap
// ------------------------------------------------------------------------
const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

// ------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------

/**
 * Reveals votes for a room, locks voting, and stops the timer.
 * Emits timer:stopped and votes:reveal to the entire room.
 */
function revealVotes(room, reason) {
  clearRoomTimer(room);
  room.votingLocked = true;
  io.to(room.id).emit('timer:stopped', { reason });
  io.to(room.id).emit('votes:reveal', { votes: room.votes });
}

/**
 * Starts the server-side countdown interval for a room.
 */
function startTimerInterval(room) {
  // Emit an immediate tick so clients see the first state right away
  io.to(room.id).emit('timer:tick', {
    remaining: room.timerRemaining,
    total: room.timerDuration,
    isRunning: true,
  });

  room.timerInterval = setInterval(() => {
    const currentRoom = getRoom(room.id);
    if (!currentRoom || !currentRoom.timerRunning) return;

    currentRoom.timerRemaining = Math.max(0, currentRoom.timerRemaining - 1);

    io.to(currentRoom.id).emit('timer:tick', {
      remaining: currentRoom.timerRemaining,
      total: currentRoom.timerDuration,
      isRunning: true,
    });

    if (currentRoom.timerRemaining === 0) {
      revealVotes(currentRoom, 'expired');
    }
  }, 1000);
}

// ------------------------------------------------------------------------
// Socket handlers
// ------------------------------------------------------------------------
io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // Track which room this socket is in (for disconnect handling)
  let currentRoomId = null;

  // ----------------------------------------------------------------
  // room:join
  // ----------------------------------------------------------------
  socket.on('room:join', ({ roomId }) => {
    if (!roomId) return;
    socket.join(roomId);
    currentRoomId = roomId;
    const { room, isHost: hostFlag } = joinRoom(roomId, socket.id);
    socket.emit('room:joined', {
      roomId,
      isHost: hostFlag,
      timerRemaining: room.timerRemaining,
      timerDuration: room.timerDuration,
      timerRunning: room.timerRunning,
    });
  });

  // ----------------------------------------------------------------
  // timer:start   { duration: number }
  // ----------------------------------------------------------------
  socket.on('timer:start', ({ duration } = {}) => {
    if (!currentRoomId) return;
    if (!isHost(currentRoomId, socket.id)) return; // host-only

    const room = getRoom(currentRoomId);
    if (!room) return;
    if (room.timerRunning) return; // already running

    const d = Number(duration);
    if (!Number.isFinite(d) || d < 10 || d > 300) return;

    room.timerDuration = d;
    room.timerRemaining = d;
    room.timerRunning = true;
    room.votingLocked = false;
    room.votes = {};

    startTimerInterval(room);
  });

  // ----------------------------------------------------------------
  // timer:pause
  // ----------------------------------------------------------------
  socket.on('timer:pause', () => {
    if (!currentRoomId) return;
    if (!isHost(currentRoomId, socket.id)) return;

    const room = getRoom(currentRoomId);
    if (!room || !room.timerRunning) return;

    clearRoomTimer(room);
    io.to(room.id).emit('timer:tick', {
      remaining: room.timerRemaining,
      total: room.timerDuration,
      isRunning: false,
    });
    io.to(room.id).emit('timer:stopped', { reason: 'manual' });
  });

  // ----------------------------------------------------------------
  // timer:reset
  // ----------------------------------------------------------------
  socket.on('timer:reset', () => {
    if (!currentRoomId) return;
    if (!isHost(currentRoomId, socket.id)) return;

    const room = getRoom(currentRoomId);
    if (!room) return;

    resetTimer(room);
    io.to(room.id).emit('timer:tick', {
      remaining: room.timerRemaining,
      total: room.timerDuration,
      isRunning: false,
    });
  });

  // ----------------------------------------------------------------
  // vote:cast     { roomId: string, value: any }
  // ----------------------------------------------------------------
  socket.on('vote:cast', ({ roomId, value } = {}) => {
    if (!roomId) return;
    const accepted = castVote(roomId, socket.id, value);
    if (!accepted) return;

    const room = getRoom(roomId);
    if (!room) return;

    // AC6 - all members voted before timer expires
    if (allVotesCast(room) && room.timerRunning) {
      revealVotes(room, 'all_voted');
    }
  });

  // ----------------------------------------------------------------
  // disconnect - reassign host if needed
  // ----------------------------------------------------------------
  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    if (!currentRoomId) return;
    const { newHostSocketId } = leaveRoom(currentRoomId, socket.id);
    if (newHostSocketId) {
      io.to(currentRoomId).emit('host:changed', { newHostSocketId });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Planning Poker server listening on port ${PORT}`);
});

module.exports = { server, io }; // exported for testing

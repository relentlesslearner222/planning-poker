/**
 * server/index.js
 *
 * Planning Poker – Node.js + Socket.io server
 * Adds: server-synchronised countdown timer (issue #10)
 *
 * Room state shape:
 *  {
 *    participants : Map<socketId, { name }>,
 *    hostSocketId : string | null,
 *    votes        : Map<socketId, value>,
 *    votesRevealed: boolean,
 *    timerDuration : number,   // seconds chosen by host
 *    timerRemaining: number,   // seconds left
 *    timerStatus   : 'idle' | 'running' | 'paused' | 'finished',
 *    _interval     : NodeJS.Timeout | null,
 *  }
 */

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*' },
});

// ─── in-memory room registry ──────────────────────────────────────────
const rooms = new Map(); // roomId |→ roomState

function createRoom() {
  return {
    participants : new Map(),
    hostSocketId : null,
    votes        : new Map(),
    votesRevealed: false,
    timerDuration : 300,
    timerRemaining: 300,
    timerStatus   : 'idle',
    _interval     : null,
  };
}

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, createRoom());
  return rooms.get(roomId);
}

// ─── timer helpers ───────────────────────────────────────────

function clearRoomInterval(room) {
  if (room._interval) {
    clearInterval(room._interval);
    room._interval = null;
  }
}

function broadcastTimerState(roomId, room) {
  io.to(roomId).emit('timer:tick', {
    remaining: room.timerRemaining,
    status   : room.timerStatus,
    duration : room.timerDuration,
  });
}

function expireTimer(roomId, room) {
  clearRoomInterval(room);
  room.timerStatus    = 'finished';
  room.timerRemaining = 0;
  room.votesRevealed  = true;

  io.to(roomId).emit('timer:expired', {
    votes: object.fromEntries(room.votes),
  });
}

function startRoomInterval(roomId, room) {
  clearRoomInterval(room);
  room._interval = setInterval(() => {
    if (room.timerStatus !== 'running') {
      clearRoomInterval(room);
      return;
    }
    room.timerRemaining -= 1;
    broadcastTimerState(roomId, room);

    if (room.timerRemaining <= 0) {
      expireTimer(roomId, room);
    }
  }, 1000);
}

// ─── host re-assignment ─────────────────────────────────────────

function reassignHost(room, roomId) {
  if (room.participants.size === 0) {
    room.hostSocketId = null;
    return;
  }
  // oldest remaining socket becomes host (Maps preserve insertion order)
  const [nextHostId] = room.participants.keys();
  room.hostSocketId = nextHostId;
  io.to(roomId).emit('host:changed', { hostSocketId: nextHostId });
}

// ─── vote-reveal helper ──────────────────────────────────────────

function checkAllVoted(roomId, room) {
  const participantCount = room.participants.size;
  if (participantCount === 0) return;
  if (room.votes.size >= participantCount && !room.votesRevealed) {
    clearRoomInterval(room);
    room.timerStatus   = 'finished';
    room.votesRevealed = true;
    io.to(roomId).emit('timer:expired', {
      votes      : Object.fromEntries(room.votes),
      earlyReveal: true,
    });
  }
}

// ─── socket connection handler ──────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ┌ join room ┌───────────────────────────────────────────────────────────┐
  socket.on('room:join', ({ roomId, name }) => {
    if (!roomId || !name) return;

    const room = getRoom(roomId);
    socket.join(roomId);

    const isFirstParticipant = room.participants.size === 0;
    room.participants.set(socket.id, { name });

    if (isFirstParticipant) {
      room.hostSocketId = socket.id;
    }

    socket.emit('room:joined', {
      hostSocketId  : room.hostSocketId,
      timerRemaining: room.timerRemaining,
      timerStatus   : room.timerStatus,
      timerDuration : room.timerDuration,
      votesRevealed : room.votesRevealed,
      participants  : Object.fromEntries(
        [...room.participants].map(([id, p]) => [id, p.name])
      ),
    });

    socket.to(roomId).emit('participant:joined', {
      socketId: socket.id,
      name,
      hostSocketId: room.hostSocketId,
    });
  });

  // ┌ cast vote ┌──────────────────────────────────────────────────────────┐
  socket.on('vote:cast', ({ roomId, value }) => {
    const room = rooms.get(roomId);
    if (!room || room.votesRevealed || room.timerStatus === 'finished') return;

    room.votes.set(socket.id, value);
    io.to(roomId).emit('vote:received', { socketId: socket.id });
    checkAllVoted(roomId, room);
  });

  // ┌ timer:start ┌─────────────────────────────────────────────────────────┐
  socket.on('timer:start', ({ roomId, duration }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostSocketId) return;
    if (room.timerStatus === 'running') return;

    if (room.timerStatus === 'idle' || room.timerStatus === 'finished') {
      const secs = Math.min(Math.max(Number(duration) || room.timerDuration, 60), 600);
      room.timerDuration  = secs;
      room.timerRemaining = secs;
      room.votes.clear();
      room.votesRevealed  = false;
    }
    room.timerStatus = 'running';
    startRoomInterval(roomId, room);
    broadcastTimerState(roomId, room);
  });

  // ┌ timer:pause ┌─────────────────────────────────────────────────────────┐
  socket.on('timer:pause', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostSocketId) return;
    if (room.timerStatus !== 'running') return;

    clearRoomInterval(room);
    room.timerStatus = 'paused';
    broadcastTimerState(roomId, room);
  });

  // ┌ timer:reset ┌─────────────────────────────────────────────────────────┐
  socket.on('timer:reset', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostSocketId) return;

    clearRoomInterval(room);
    room.timerStatus    = 'idle';
    room.timerRemaining = room.timerDuration;
    room.votes.clear();
    room.votesRevealed  = false;
    broadcastTimerState(roomId, room);
    io.to(roomId).emit('votes:cleared');
  });

  // ┌ disconnect ┌────────────────────────────────────────────────────────┐
  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    rooms.forEach((room, roomId) => {
      if (!room.participants.has(socket.id)) return;

      room.participants.delete(socket.id);
      room.votes.delete(socket.id);

      if (room.hostSocketId === socket.id) {
        reassignHost(room, roomId);
      }

      io.to(roomId).emit('participant:left', {
        socketId    : socket.id,
        hostSocketId: room.hostSocketId,
      });

      if (room.participants.size === 0) {
        clearRoomInterval(room);
        rooms.delete(roomId);
      } else {
        checkAllVoted(roomId, room);
      }
    });
  });
});

// ─── start server ────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server listening on :${PORT}`));
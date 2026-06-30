const { v4: uuidv4 } = require('uuid');

/**
 * In-memory room state.
 *
 * Room shape:
 * {
 *   id: string,
 *   hostId: string,
 *   participants: Map<socketId, { id, name, vote: string|null }>,
 *   revealed: boolean,
 *   timer: {
 *     intervalRef: NodeJS.Timeout|null,
 *     remaining: number,
 *     totalDuration: number,
 *     running: boolean
 *   }
 * }
 */
function createRoomManager(io) {
  /** @type {Map<string, object>} roomId → room */
  const rooms = new Map();
  /** @type {Map<string, string>} socketId → roomId */
  const socketToRoom = new Map();

  // ── Helpers ──────────────────────────────────────────────────────────
  function getRoom(roomId) {
    return rooms.get(roomId);
  }

  function getRoomForSocket(socketId) {
    const roomId = socketToRoom.get(socketId);
    return roomId ? rooms.get(roomId) : null;
  }

  function broadcastRoomState(room) {
    const participants = Array.from(room.participants.values()).map((p) => ({
      id: p.id,
      name: p.name,
      // Only expose vote value when revealed or it belongs to the sender
      vote: room.revealed ? p.vote : p.vote !== null ? '?' : null
    }));
    io.to(room.id).emit('room:state', {
      roomId: room.id,
      hostId: room.hostId,
      participants,
      revealed: room.revealed
    });
  }

  function broadcastTimerSync(room) {
    io.to(room.id).emit('timerSync', {
      remaining: room.timer.remaining,
      running: room.timer.running,
      totalDuration: room.timer.totalDuration
    });
  }

  function stopTimerInterval(room) {
    if (room.timer.intervalRef) {
      clearInterval(room.timer.intervalRef);
      room.timer.intervalRef = null;
    }
  }

  // ── Public API ───────────────────────────────────────────────────────
  function joinRoom(socket, roomId, userName) {
    if (!roomId || !userName) {
      socket.emit('error', { message: 'roomId and userName are required' });
      return;
    }

    // Leave any existing room first
    leaveRoom(socket);

    let room = rooms.get(roomId);
    if (!room) {
      // First joiner becomes host
      room = {
        id: roomId,
        hostId: socket.id,
        participants: new Map(),
        revealed: false,
        timer: {
          intervalRef: null,
          remaining: 0,
          totalDuration: 0,
          running: false
        }
      };
      rooms.set(roomId, room);
      console.log(`[room] created: ${roomId}`);
    }

    room.participants.set(socket.id, {
      id: socket.id,
      name: userName,
      vote: null
    });
    socketToRoom.set(socket.id, roomId);
    socket.join(roomId);

    console.log(`[room] ${userName} (${socket.id}) joined ${roomId}`);

    // Tell the joiner if they are host
    socket.emit('room:joined', {
      roomId,
      isHost: room.hostId === socket.id
    });

    broadcastRoomState(room);

    // Sync current timer state to newcomer
    socket.emit('timerSync', {
      remaining: room.timer.remaining,
      running: room.timer.running,
      totalDuration: room.timer.totalDuration
    });
  }

  function leaveRoom(socket) {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    room.participants.delete(socket.id);
    socketToRoom.delete(socket.id);
    socket.leave(roomId);

    console.log(`[room] ${socket.id} left ${roomId}`);

    if (room.participants.size === 0) {
      stopTimerInterval(room);
      rooms.delete(roomId);
      console.log(`[room] destroyed (empty): ${roomId}`);
      return;
    }

    // Re-assign host if the host left
    if (room.hostId === socket.id) {
      room.hostId = room.participants.keys().next().value;
      console.log(`[room] new host: ${room.hostId}`);
    }

    broadcastRoomState(room);
  }

  function castVote(socket, value) {
    const room = getRoomForSocket(socket.id);
    if (!room) return;
    if (room.revealed) {
      socket.emit('error', { message: 'Votes already revealed — reset first' });
      return;
    }
    const participant = room.participants.get(socket.id);
    if (!participant) return;

    participant.vote = String(value);
    broadcastRoomState(room);
  }

  function revealVotes(socket) {
    const room = getRoomForSocket(socket.id);
    if (!room) return;
    if (room.hostId !== socket.id) {
      socket.emit('error', { message: 'Only the host can reveal votes' });
      return;
    }
    room.revealed = true;

    // Build full participant list with real votes for reveal event
    const participants = Array.from(room.participants.values()).map((p) => ({
      id: p.id,
      name: p.name,
      vote: p.vote
    }));
    io.to(room.id).emit('vote:revealed', { participants });
    broadcastRoomState(room);
  }

  function resetVotes(socket) {
    const room = getRoomForSocket(socket.id);
    if (!room) return;
    if (room.hostId !== socket.id) {
      socket.emit('error', { message: 'Only the host can reset votes' });
      return;
    }
    room.revealed = false;
    room.participants.forEach((p) => { p.vote = null; });
    cancelTimer(socket);
    broadcastRoomState(room);
  }

  function startTimer(socket, durationMs) {
    const room = getRoomForSocket(socket.id);
    if (!room) return;
    if (room.hostId !== socket.id) {
      socket.emit('error', { message: 'Only the host can start the timer' });
      return;
    }

    // Server-side clamp [10 000, 300 000] ms
    const clamped = Math.min(Math.max(Number(durationMs) || 60000, 10000), 300000);

    stopTimerInterval(room);
    room.timer.remaining = clamped;
    room.timer.totalDuration = clamped;
    room.timer.running = true;

    broadcastTimerSync(room);

    const TICK_MS = 200;
    room.timer.intervalRef = setInterval(() => {
      room.timer.remaining = Math.max(0, room.timer.remaining - TICK_MS);
      broadcastTimerSync(room);
      if (room.timer.remaining <= 0) {
        stopTimerInterval(room);
        room.timer.running = false;
        broadcastTimerSync(room);
      }
    }, TICK_MS);
  }

  function cancelTimer(socket) {
    const room = getRoomForSocket(socket.id);
    if (!room) return;
    if (room.hostId !== socket.id) {
      socket.emit('error', { message: 'Only the host can cancel the timer' });
      return;
    }
    stopTimerInterval(room);
    room.timer.running = false;
    room.timer.remaining = 0;
    broadcastTimerSync(room);
  }

  // Expose internals for testing
  return {
    joinRoom,
    leaveRoom,
    castVote,
    revealVotes,
    resetVotes,
    startTimer,
    cancelTimer,
    getRooms: () => rooms,
    getSocketToRoom: () => socketToRoom
  };
}

module.exports = { createRoomManager };

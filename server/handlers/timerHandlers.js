import { findRoomBySocket, serializeVotesRevealed } from '../rooms.js';

const TICK_MS = 500;
const MIN_MS = 10000;
const MAX_MS = 300000;

/**
 * Cancel and clear the interval for a room's timer.
 * @param {object} room
 */
export function cancelTimer(room) {
  if (room.timer.intervalId !== null) {
    clearInterval(room.timer.intervalId);
    room.timer.intervalId = null;
  }
  room.timer.running = false;
}

export function registerTimerHandlers(io, socket) {
  /** timer:start — host starts a countdown */
  socket.on('timer:start', ({ durationMs }) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    if (socket.id !== room.hostSocketId) {
      socket.emit('room:error', { message: 'Only the host can start the timer.' });
      return;
    }
    if (room.revealed) {
      socket.emit('room:error', { message: 'Round already revealed. Reset first.' });
      return;
    }

    // Clamp duration
    const clamped = Math.min(Math.max(durationMs, MIN_MS), MAX_MS);

    // Cancel any existing timer
    cancelTimer(room);

    room.timer.remaining = clamped;
    room.timer.totalDuration = clamped;
    room.timer.running = true;

    // Immediately sync state
    io.to(room.roomId).emit('timer:sync', {
      remaining: room.timer.remaining,
      running: room.timer.running,
      totalDuration: room.timer.totalDuration,
    });

    room.timer.intervalId = setInterval(() => {
      room.timer.remaining -= TICK_MS;

      if (room.timer.remaining <= 0) {
        room.timer.remaining = 0;
        cancelTimer(room);

        // Emit final sync
        io.to(room.roomId).emit('timer:sync', {
          remaining: 0,
          running: false,
          totalDuration: room.timer.totalDuration,
        });

        // Auto-reveal if not already revealed
        if (!room.revealed) {
          room.revealed = true;
          io.to(room.roomId).emit('vote:revealed', {
            votes: serializeVotesRevealed(room),
          });
          console.log(`[timer] auto-reveal in ${room.roomId}`);
        }
        return;
      }

      io.to(room.roomId).emit('timer:sync', {
        remaining: room.timer.remaining,
        running: room.timer.running,
        totalDuration: room.timer.totalDuration,
      });
    }, TICK_MS);

    console.log(`[timer] started in ${room.roomId} for ${clamped}ms`);
  });

  /** timer:cancel — host cancels the running timer */
  socket.on('timer:cancel', () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    if (socket.id !== room.hostSocketId) {
      socket.emit('room:error', { message: 'Only the host can cancel the timer.' });
      return;
    }

    cancelTimer(room);

    io.to(room.roomId).emit('timer:sync', {
      remaining: room.timer.remaining,
      running: false,
      totalDuration: room.timer.totalDuration,
    });

    console.log(`[timer] cancelled in ${room.roomId}`);
  });
}

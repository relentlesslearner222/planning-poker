// timerHandlers.js
// ------------------
// Handles all timer-related Socket.io events for the Planning Poker timer feature.
//
// Socket events handled (host-only, validated server-side):
//   timer:start  -- start or resume the countdown
//   timer:pause  -- pause the countdown
//   timer:reset  -- reset timer to configured duration
//
// Socket events emitted to room:
//   timer:started  -- timer has begun / resumed
//   timer:paused   -- timer is paused
//   timer:reset    -- timer has been reset to initial duration
//   timer:tick     -- every-second update with remainingMs
//   timer:expired  -- timer reached zero; votes locked + auto-revealed

'use strict';

const TICK_INTERVAL_MS = 1000;

// Map<roomId, intervalId> -- one interval per room
const roomIntervals = new Map();

function defaultTimerState(durationMs = 60000) {
  return {
    duration: durationMs,
    startedAt: null,
    pausedAt: null,
    remainingMs: durationMs,
    status: 'idle',
  };
}

function computeRemainingMs(timer) {
  if (timer.status !== 'running') return timer.remainingMs;
  const elapsed = Date.now() - timer.startedAt;
  return Math.max(0, timer.remainingMs - elapsed);
}

function clearRoomInterval(roomId) {
  if (roomIntervals.has(roomId)) {
    clearInterval(roomIntervals.get(roomId));
    roomIntervals.delete(roomId);
  }
}

function startTickInterval(roomId, room, io, revealFn) {
  clearRoomInterval(roomId);
  const intervalId = setInterval(() => {
    const remaining = computeRemainingMs(room.timer);
    io.to(roomId).emit('timer:tick', { remainingMs: remaining, status: room.timer.status });
    if (remaining <= 0) {
      clearRoomInterval(roomId);
      room.timer.status = 'expired';
      room.timer.remainingMs = 0;
      room.votingLocked = true;
      io.to(roomId).emit('timer:expired', { roomId });
      if (typeof revealFn === 'function') revealFn(room, roomId, io);
    }
  }, TIAK_INTERVAL_MS);
  roomIntervals.set(roomId, intervalId);
}

function registerTimerHandlers(socket, io, rooms, revealFn) {
  socket.on('timer:start', ({ roomId, durationSeconds } = {}) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.hostId !== socket.id) { socket.emit('timer:error', { message: 'Only the host can control the timer.' }); return; }
    if (!room.timer) { const ms = (durationSeconds && durationSeconds > 0) ? durationSeconds * 1000 : 60000; room.timer = defaultTimerState(ms); }
    const timer = room.timer;
    if (timer.status === 'running') return;
    if (timer.status === 'paused') {
      timer.startedAt = Date.now(); timer.pausedAt = null; timer.status = 'running';
    } else {
      if (durationSeconds && durationSeconds > 0) timer.duration = durationSeconds * 1000;
      timer.remainingMs = timer.duration; timer.startedAt = Date.now(); timer.pausedAt = null; timer.status = 'running';
    }
    room.votingLocked = false;
    io.to(roomId).emit('timer:started', { remainingMs: timer.remainingMs, duration: timer.duration, startedAt: timer.startedAt, status: timer.status });
    startTickInterval(roomId, room, io, revealFn);
  });

  socket.on('timer:pause', ({ roomId } = {}) => {
    const room = rooms.get(roomId);
    if (!room || !room.timer) return;
    if (room.hostId !== socket.id) { socket.emit('timer:error', { message: 'Only the host can control the timer.' }); return; }
    if (room.timer.status !== 'running') return;
    clearRoomInterval(roomId);
    room.timer.remainingMs = computeRemainingMs(room.timer);
    room.timer.pausedAt = Date.now();
    room.timer.status = 'paused';
    io.to(roomId).emit('timer:paused', { remainingMs: room.timer.remainingMs, status: room.timer.status });
  });

  socket.on('timer:reset', ({ roomId, durationSeconds } = {}) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.hostId !== socket.id) { socket.emit('timer:error', { message: 'Only the host can control the timer.' }); return; }
    clearRoomInterval(roomId);
    const ms = (durationSeconds && durationSeconds > 0) ? durationSeconds * 1000 : (room.timer ? room.timer.duration : 60000);
    room.timer = defaultTimerState(ms);
    room.votingLocked = false;
    io.to(roomId).emit('timer:reset', { remainingMs: room.timer.remainingMs, duration: room.timer.duration, status: room.timer.status });
  });
}

function checkAllVoted(roomId, room, io, revealFn) {
  if (!room.timer || room.timer.status !== 'running') return;
  if (!room.participants || room.participants.length === 0) return;
  const allVoted = room.participants.every(p => room.votes && room.votes[p.id] !== undefined);
  if (allVoted) {
    clearRoomInterval(roomId);
    room.timer.status = 'paused';
    room.timer.remainingMs = computeRemainingMs(room.timer);
    io.to(roomId).emit('timer:paused', { remainingMs: room.timer.remainingMs, status: 'paused', reason: 'all-voted' });
    if (typeof revealFn === 'function') revealFn(room, roomId, io);
  }
}

function destroyRoomTimer(roomId) { clearRoomInterval(roomId); }

module.exports = { defaultTimerState, registerTimerHandlers, checkAllVoted, destroyRoomTimer };
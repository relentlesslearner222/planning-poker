/**
 * timerController.js
 * Server-side timer logic for Planning Poker.
 * All timer state is driven by the server to prevent client drift.
 */

/**
 * Start (or restart) the countdown for a room.
 * Assumes room.timer.remainingMs is already set to the desired duration.
 *
 * @param {import('socket.io').Server} io
 * @param {string} roomId
 * @param {object} room  - live room object from roomState
 */
function startTimer(io, roomId, room) {
  if (room.timer.state === 'running') {
    // Already running - ignore duplicate start requests
    return;
  }

  room.timer.state = 'running';
  room.timer.startedAt = Date.now();

  room.timer.intervalRef = setInterval(() => {
    const elapsed = Date.now() - room.timer.startedAt;
    room.timer.remainingMs = Math.max(0, room.timer.remainingMs - elapsed);
    room.timer.startedAt = Date.now(); // re-anchor for next tick

    io.to(roomId).emit('timer:tick', {
      remainingMs: room.timer.remainingMs,
      state: room.timer.state,
    });

    if (room.timer.remainingMs <= 0) {
      expireTimer(io, roomId, room);
    }
  }, 1000);
}

/**
 * Pause the running timer.
 * Saves remaining time so resume can pick up from here.
 */
function pauseTimer(io, roomId, room) {
  if (room.timer.state !== 'running') return;

  clearInterval(room.timer.intervalRef);
  room.timer.intervalRef = null;

  const elapsed = Date.now() - room.timer.startedAt;
  room.timer.remainingMs = Math.max(0, room.timer.remainingMs - elapsed);
  room.timer.state = 'paused';

  io.to(roomId).emit('timer:paused', { remainingMs: room.timer.remainingMs });
}

/**
 * Resume a paused timer from its saved remainingMs.
 */
function resumeTimer(io, roomId, room) {
  if (room.timer.state !== 'paused') return;
  startTimer(io, roomId, room);
}

/**
 * Reset timer to the configured duration, clear all votes, notify clients.
 */
function resetTimer(io, roomId, room) {
  clearInterval(room.timer.intervalRef);
  room.timer.intervalRef = null;
  room.timer.state = 'idle';
  room.timer.remainingMs = room.timer.durationMs;
  room.timer.startedAt = null;

  if (room.votes) {
    Object.keys(room.votes).forEach((k) => delete room.votes[k]);
  }
  room.votingLocked = false;
  room.revealed = false;

  io.to(roomId).emit('timer:reset', { durationMs: room.timer.durationMs });
  io.to(roomId).emit('timer:tick', {
    remainingMs: room.timer.remainingMs,
    state: room.timer.state,
  });
}

/**
 * Called when remainingMs reaches 0.
 * Locks voting and triggers vote reveal.
 */
function expireTimer(io, roomId, room) {
  clearInterval(room.timer.intervalRef);
  room.timer.intervalRef = null;
  room.timer.state = 'idle';
  room.timer.remainingMs = 0;

  room.votingLocked = true;
  room.revealed = true;

  io.to(roomId).emit('timer:expired');
  io.to(roomId).emit('votes:rovealed', { votes: room.votes });
}

/**
 * Stop the timer early because all participants have voted.
 */
function stopTimerAllVoted(io, roomId, room) {
  clearInterval(room.timer.intervalRef);
  room.timer.intervalRef = null;
  room.timer.state = 'idle';

  room.votingLocked = true;
  room.revealed = true;

  io.to(roomId).emit('timer:stopped', { reason: 'all_voted' });
  io.to(roomId).emit('votes:revealed', { votes: room.votes });
}

module.exports = {
  startTimer,
  pauseTimer,
  resumeTimer,
  resetTimer,
  expireTimer,
  stopTimerAllVoted,
};
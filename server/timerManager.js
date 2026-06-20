/**
 * timerManager.js
 *
 * Server-side countdown timer manager for Planning Poker (issue #10).
 *
 * Responsibilities
 * ─────────────────
 *  │ Store per-room timer state entirely on the server (AC3).
 *  │ Emit `timer:tick` every second to all members of a room.
 *  │ Emit `timer:expired` + lock voting when the countdown reaches 0 (AC4).
 *  │ Emit `timer:early-reveal` when all participants have voted (AC5).
 *  │ Track host assignment (first joiner) and re-assign on disconnect (AC1).
 *
 * Timer state schema
 * ─ₔ─ₔ─
 *  {
 *    hostId     : string,          // socket.id of the room host
 *    memberIds  : string[],        // join-order list of socket ids
 *    duration   : number,          // configured duration in seconds (default 60)
 *    remaining  : number,          // seconds left
 *    startedAt  : number|null,     // Date.now() when last started/resumed
 *    paused     : boolean,
 *    running    : boolean,
 *    votingLocked: boolean,
 *    votes      : Map<socketId, value>
 *    intervalId : ReturnType<setInterval> | null
 *  }
 */

'use strict';

const DEFAULT_DURATION = 60; // seconds

/** @type {Map<string, object>} roomId timerState */
const rooms = new Map();

// ── Internal helpers ───────────────────────────────────────────────

function createRoomState(hostId) {
  return {
    hostId,
    memberIds: [hostId],
    duration: DEFAULT_DURATION,
    remaining: DEFAULT_DURATION,
    startedAt: null,
    paused: false,
    running: false,
    votingLocked: false,
    votes: new Map(),
    intervalId: null,
  };
}

function getOrCreateRoom(roomId, socketId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, createRoomState(socketId));
  }
  return rooms.get(roomId);
}

function clearTick(state) {
  if (state.intervalId !== null) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
}

/**
 * Derive a safe public snapshot (no intervalId, no raw Map) to send to clients.
 */
function publicState(state) {
  return {
    hostId: state.hostId,
    duration: state.duration,
    remaining: state.remaining,
    paused: state.paused,
    running: state.running,
    votingLocked: state.votingLocked,
  };
}

// ── Core timer loop ─────────────────────────────────────────────────

/**
 * Start (or resume) the per-second tick loop for a room.
 * @param {string}   roomId
 * @param {object}   io      - Socket.io server instance
 */
function startTick(roomId, io) {
  const state = rooms.get(roomId);
  if (!state) return;

  clearTick(state);
  state.running = true;
  state.paused = false;
  state.startedAt = Date.now();

  state.intervalId = setInterval(() => {
    const s = rooms.get(roomId);
    if (!s) return clearInterval(state.intervalId);

    s.remaining = Math.max(0, s.remaining - 1);

    // Broadcast tick to every client in the room
    io.to(roomId).emit('timer:tick', publicState(s));

    if (s.remaining <= 0) {
      expireTimer(roomId, io);
    }
  }, 1000);
}

// ── Exported API ──────────────────────────────────────────────────

/**
 * Called when a socket joins a room.
 * Returns the current public state so the joining client can sync immediately.
 */
function joinRoom(roomId, socketId) {
  const state = getOrCreateRoom(roomId, socketId);
  if (!state.memberIds.includes(socketId)) {
    state.memberIds.push(socketId);
  }
  return publicState(state);
}

/**
 * Called when a socket leaves / disconnects.
 * Re-assigns host to the next oldest member if the host left (AC1).
 */
function leaveRoom(roomId, socketId) {
  const state = rooms.get(roomId);
  if (!state) return;

  state.memberIds = state.memberIds.filter((id) => id !== socketId);
  state.votes.delete(socketId);

  if (state.memberIds.length === 0) {
    // Last person left clean up entirely
    clearTick(state);
    rooms.delete(roomId);
    return null;
  }

  if (state.hostId === socketId) {
    // Re-assign to next oldest member (AC1)
    state.hostId = state.memberIds[0];
  }

  return { newHostId: state.hostId, state: publicState(state) };
}

/**
 * Configure the timer duration (host only, validated at event layer).
 */
function configure(roomId, durationSeconds) {
  const state = rooms.get(roomId);
  if (!state || state.running) return null;

  const dur = Math.max(5, Math.min(3600, Number(durationSeconds)));
  state.duration = dur;
  state.remaining = dur;
  return publicState(state);
}

/**
 * Start or resume the countdown.
 */
function start(roomId, io) {
  const state = rooms.get(roomId);
  if (!state || state.running || state.votingLocked) return null;

  if (state.remaining <= 0) {
    state.remaining = state.duration; // auto-reset if already expired
  }

  startTick(roomId, io);
  return publicState(state);
}

/**
 * Pause the countdown.
 */
function pause(roomId) {
  const state = rooms.get(roomId);
  if (!state || !state.running) return null;

  clearTick(state);
  state.running = false;
  state.paused = true;
  return publicState(state);
}

/**
 * Reset the countdown back to the configured duration.
 */
function reset(roomId) {
  const state = rooms.get(roomId);
  if (!state) return null;

  clearTick(state);
  state.running = false;
  state.paused = false;
  state.remaining = state.duration;
  state.votingLocked = false;
  state.votes.clear();
  return publicState(state);
}

/**
 * Record a vote for a participant. Triggers early-reveal if everyone voted (AC5).
 */
function castVote(roomId, socketId, value, io) {
  const state = rooms.get(roomId);
  if (!state || state.votingLocked) return;

  state.votes.set(socketId, value);

  const allVoted =
    state.memberIds.length > 0 &&
    state.memberIds.every((id) => state.votes.has(id));

  if (allVoted) {
    clearTick(state);
    state.running = false;
    state.votingLocked = true;

    const revealed = Object.fromEntries(state.votes);
    io.to(roomId).emit('timer:early-reveal', {
      votes: revealed,
      state: publicState(state),
    });
  }
}

/**
 * Called internally when the countdown reaches 0 (AC4).
 */
function expireTimer(roomId, io) {
  const state = rooms.get(roomId);
  if (!state) return;

  clearTick(state);
  state.running = false;
  state.remaining = 0;
  state.votingLocked = true;

  const revealed = Object.fromEntries(state.votes);
  io.to(roomId).emit('timer:expired', {
    votes: revealed,
    state: publicState(state),
  });
}

/**
 * Returns the raw state (for internal use / re-sync on reconnect).
 */
function getRoomState(roomId) {
  const state = rooms.get(roomId);
  return state ? publicState(state) : null;
}

/**
 * Returns the hostId for a room (used by event layer for auth checks).
 */
function getHostId(roomId) {
  return rooms.get(roomId)?.hostId ?? null;
}

module.exports = {
  joinRoom,
  leaveRoom,
  configure,
  start,
  pause,
  reset,
  castVote,
  getRoomState,
  getHostId,
};

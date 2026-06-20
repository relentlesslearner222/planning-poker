/**
 * roomManager.js
 *
 * Manages all server-side room state for the Planning Poker application,
 * including participant tracking, host assignment, vote storage, and
 * the server-authoritative timer state required by issue #10.
 *
 * Room shape:
 * {
 *   participants: Map<socketId, { name: string }>,
 *   hostSocketId: string | null,
 *   votes: Map<socketId, string | number>,
 *   votesRevealed: boolean,
 *   votingLocked: boolean,
 *   timerState: {
 *     status: 'idle' | 'running' | 'paused' | 'expired',
 *     durationMs: number,       // configured total duration in ms
 *     remaining: number,        // remaining time in ms
 *     startedAt: number | null, // Date.now() snapshot when last started/resumed
 *     intervalId: NodeJS.Timeout | null,
 *   }
 * }
 */

/** @type {Map<string, object>} roomId -> room */
const rooms = new Map();

/** Default timer duration in milliseconds (60 seconds). */
const DEFAULT_DURATION_MS = 60_000;

// ---------------------------------------------------------------------------
// Room lifecycle helpers
// ---------------------------------------------------------------------------

/**
 * Returns an existing room or creates a fresh one.
 * @param {string} roomId
 * @returns {object} room
 */
function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      participants: new Map(),
      hostSocketId: null,
      votes: new Map(),
      votesRevealed: false,
      votingLocked: false,
      timerState: createFreshTimerState(),
    });
  }
  return rooms.get(roomId);
}

/**
 * Returns a fresh (idle) timer state object.
 * @returns {object}
 */
function createFreshTimerState() {
  return {
    status: 'idle',
    durationMs: DEFAULT_DURATION_MS,
    remaining: DEFAULT_DURATION_MS,
    startedAt: null,
    intervalId: null,
  };
}

// ---------------------------------------------------------------------------
// Participant management
// ---------------------------------------------------------------------------

/**
 * Adds a participant to a room and assigns host if the room was empty.
 * @param {string} roomId
 * @param {string} socketId
 * @param {string} name  display name chosen by the participant
 * @returns {{ room: object, isHost: boolean }}
 */
function addParticipant(roomId, socketId, name) {
  const room = getOrCreateRoom(roomId);
  const isFirstParticipant = room.participants.size === 0;

  room.participants.set(socketId, { name });

  // The first socket to join becomes host (AC1).
  if (isFirstParticipant || room.hostSocketId === null) {
    room.hostSocketId = socketId;
  }

  return { room, isHost: room.hostSocketId === socketId };
}

/**
 * Removes a participant from a room.
 * If the departing socket was the host, the next oldest member becomes host (AC1).
 * Cleans up the room entirely when empty.
 *
 * @param {string} roomId
 * @param {string} socketId
 * @returns {{ room: object | null, newHostSocketId: string | null }}
 *   room is null when the room was removed; newHostSocketId is non-null when
 *   host re-assignment occurred.
 */
function removeParticipant(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return { room: null, newHostSocketId: null };

  room.participants.delete(socketId);
  room.votes.delete(socketId);

  // Clean up empty rooms.
  if (room.participants.size === 0) {
    _clearTimerInterval(room);
    rooms.delete(roomId);
    return { room: null, newHostSocketId: null };
  }

  // Re-assign host when the departing socket was the host (AC1).
  let newHostSocketId = null;
  if (room.hostSocketId === socketId) {
    newHostSocketId = room.participants.keys().next().value; // oldest remaining
    room.hostSocketId = newHostSocketId;
  }

  return { room, newHostSocketId };
}

/**
 * Returns whether the given socket is the room host.
 * @param {string} roomId
 * @param {string} socketId
 * @returns {boolean}
 */
function isHost(roomId, socketId) {
  const room = rooms.get(roomId);
  return room ? room.hostSocketId === socketId : false;
}

// ---------------------------------------------------------------------------
// Vote management
// ---------------------------------------------------------------------------

/**
 * Records a vote from a participant.
 * @param {string} roomId
 * @param {string} socketId
 * @param {string|number} vote
 * @returns {{ room: object, allVoted: boolean }}
 */
function castVote(roomId, socketId, vote) {
  const room = rooms.get(roomId);
  if (!room) return { room: null, allVoted: false };
  if (room.votingLocked) return { room, allVoted: false };

  room.votes.set(socketId, vote);

  const allVoted =
    room.participants.size > 0 &&
    room.votes.size === room.participants.size;

  return { room, allVoted };
}

/**
 * Reveals all votes and locks further voting.
 * @param {string} roomId
 */
function revealVotes(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.votesRevealed = true;
  room.votingLocked = true;
}

/**
 * Returns a plain object of { socketId -> vote } for broadcasting.
 * @param {string} roomId
 * @returns {object}
 */
function getVotesSnapshot(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  return Object.fromEntries(room.votes);
}

// ---------------------------------------------------------------------------
// Timer state management
// ---------------------------------------------------------------------------

/**
 * Configures the timer duration for a room.
 * Clamps the value between 10 s and 300 s as per AC2.
 *
 * @param {string} roomId
 * @param {number} durationSeconds
 * @returns {object} room
 */
function configureTimer(roomId, durationSeconds) {
  const room = rooms.get(roomId);
  if (!room) return null;

  // Enforce min/max from AC2.
  const clamped = Math.min(300, Math.max(10, durationSeconds));
  const durationMs = clamped * 1000;

  room.timerState.durationMs = durationMs;
  room.timerState.remaining = durationMs;
  return room;
}

/**
 * Starts or resumes the timer.
 * The caller (index.js) is responsible for setting up the setInterval and
 * storing the intervalId back onto timerState.
 *
 * @param {string} roomId
 * @returns {object} timerState
 */
function startTimer(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  const ts = room.timerState;

  // If paused, resume with the stored remaining time.
  if (ts.status === 'paused') {
    // remaining is already set; just update startedAt.
  } else {
    // Fresh start -- reset remaining to full duration.
    ts.remaining = ts.durationMs;
  }

  ts.startedAt = Date.now();
  ts.status = 'running';
  return ts;
}

/**
 * Pauses the timer and stores the remaining time.
 * @param {string} roomId
 * @returns {object} timerState
 */
function pauseTimer(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  const ts = room.timerState;
  if (ts.status !== 'running') return ts;

  // Calculate accurate remaining at the moment of pause.
  const elapsed = Date.now() - ts.startedAt;
  ts.remaining = Math.max(0, ts.remaining - elapsed);
  ts.status = 'paused';
  ts.startedAt = null;

  _clearTimerInterval(room);
  return ts;
}

/**
 * Resets the timer to idle and clears votes.
 * @param {string} roomId
 * @returns {object} room
 */
function resetTimer(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  _clearTimerInterval(room);

  const ts = room.timerState;
  ts.remaining = ts.durationMs;
  ts.startedAt = null;
  ts.status = 'idle';

  // Clear votes and unlock voting (AC9).
  room.votes.clear();
  room.votesRevealed = false;
  room.votingLocked = false;

  return room;
}

/**
 * Marks the timer as expired and locks/reveals votes.
 * @param {string} roomId
 * @returns {object} room
 */
function expireTimer(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  _clearTimerInterval(room);

  const ts = room.timerState;
  ts.remaining = 0;
  ts.status = 'expired';
  ts.startedAt = null;

  revealVotes(roomId);
  return room;
}

/**
 * Stores an intervalId on the room's timerState.
 * Called by index.js after it creates the setInterval.
 * @param {string} roomId
 * @param {NodeJS.Timeout} intervalId
 */
function setTimerInterval(roomId, intervalId) {
  const room = rooms.get(roomId);
  if (room) room.timerState.intervalId = intervalId;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Clears any running interval on a room's timer.
 * @param {object} room
 */
function _clearTimerInterval(room) {
  if (room.timerState.intervalId !== null) {
    clearInterval(room.timerState.intervalId);
    room.timerState.intervalId = null;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  rooms,
  getOrCreateRoom,
  addParticipant,
  removeParticipant,
  isHost,
  castVote,
  revealVotes,
  getVotesSnapshot,
  configureTimer,
  startTimer,
  pauseTimer,
  resetTimer,
  expireTimer,
  setTimerInterval,
};
/**
 * roomManager.js
 * Manages in-memory room state for Planning Poker.
 *
 * Room shape:
 * {
 *   id:             string,
 *   members:        Array<{ socketId: string, joinedAt: number }>,  // ordered by join time
 *   hostSocketId:   string | null,
 *   votes:          Record<socketId, value>,
 *   votingLocked:   boolean,
 *   timerDuration:  number,   // seconds configured by host
 *   timerRemaining: number,   // seconds left
 *   timerRunning:   boolean,
 *   timerInterval:  NodeJS.Timeout | null,
 * }
 */

const rooms = new Map();

// ┐── Room lifecycle ┐───────────────────────────────────────────────────

/**
 * Returns an existing room or creates a brand-new one.
 */
function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      members: [],
      hostSocketId: null,
      votes: {},
      votingLocked: false,
      timerDuration: 60,
      timerRemaining: 60,
      timerRunning: false,
      timerInterval: null,
    });
  }
  return rooms.get(roomId);
}

/**
 * Adds a member to a room.
 * The very first member to join becomes the host.
 * Returns { room, isHost }.
 */
function joinRoom(roomId, socketId) {
  const room = getOrCreateRoom(roomId);
  const alreadyIn = room.members.some((m) => m.socketId === socketId);
  if (!alreadyIn) {
    room.members.push({ socketId, joinedAt: Date.now() });
  }
  if (!room.hostSocketId) {
    room.hostSocketId = socketId;
  }
  const isHost = room.hostSocketId === socketId;
  return { room, isHost };
}

/**
 * Removes a member from a room.
 * If the departing member was the host, reassigns to the next oldest member.
 * Returns { room, newHostSocketId } where newHostSocketId is null if unchanged
 * or the room is now empty.
 */
function leaveRoom(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return { room: null, newHostSocketId: null };

  room.members = room.members.filter((m) => m.socketId !== socketId);
  delete room.votes[socketId];

  let newHostSocketId = null;

  if (room.members.length === 0) {
    clearRoomTimer(room);
    rooms.delete(roomId);
    return { room: null, newHostSocketId: null };
  }

  if (room.hostSocketId === socketId) {
    room.hostSocketId = room.members[0].socketId;
    newHostSocketId = room.hostSocketId;
  }

  return { room, newHostSocketId };
}

// ┐── Timer helpers ┐─────────────────────────────────────────────────

/**
 * Clears any running interval for the room without mutating other state.
 */
function clearRoomTimer(room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
  room.timerRunning = false;
}

/**
 * Fully resets timer state to defaults (or to a new duration).
 */
function resetTimer(room, duration) {
  clearRoomTimer(room);
  const d = duration !== undefined ? duration : room.timerDuration;
  room.timerDuration = d;
  room.timerRemaining = d;
  room.votes = {};
  room.votingLocked = false;
}

// ┐── Vote helpers ┐───────────────────────────────────────────────────

/**
 * Records a vote if voting is not locked.
 * Returns true if the vote was accepted.
 */
function castVote(roomId, socketId, value) {
  const room = rooms.get(roomId);
  if (!room || room.votingLocked) return false;
  room.votes[socketId] = value;
  return true;
}

/**
 * Returns true if every current member has cast a vote.
 */
function allVotesCast(room) {
  if (room.members.length === 0) return false;
  return room.members.every((m) => m.socketId in room.votes);
}

// ┐── Accessors ┐─────────────────────────────────────────────────────

function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

function isHost(roomId, socketId) {
  const room = rooms.get(roomId);
  return room ? room.hostSocketId === socketId : false;
}

module.exports = {
  getOrCreateRoom,
  joinRoom,
  leaveRoom,
  clearRoomTimer,
  resetTimer,
  castVote,
  allVotesCast,
  getRoom,
  isHost,
};

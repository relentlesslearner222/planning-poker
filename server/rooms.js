/** In-memory store: roomId -> room object */
const rooms = new Map();

/**
 * Create a new room.
 * @param {string} roomId
 * @param {string} hostSocketId
 * @returns {object} the new room
 */
export function createRoom(roomId, hostSocketId) {
  const room = {
    roomId,
    hostSocketId,
    participants: [],
    votes: new Map(),
    revealed: false,
    timer: {
      intervalId: null,
      remaining: 0,
      totalDuration: 0,
      running: false,
    },
  };
  rooms.set(roomId, room);
  return room;
}

/**
 * Get a room by ID.
 * @param {string} roomId
 * @returns {object|undefined}
 */
export function getRoom(roomId) {
  return rooms.get(roomId);
}

/**
 * Delete a room.
 * @param {string} roomId
 */
export function deleteRoom(roomId) {
  rooms.delete(roomId);
}

/**
 * Add a participant to a room.
 * Returns false if name is already taken.
 * @param {object} room
 * @param {string} socketId
 * @param {string} displayName
 * @returns {boolean}
 */
export function addParticipant(room, socketId, displayName) {
  const nameTaken = room.participants.some(
    (p) => p.displayName.toLowerCase() === displayName.toLowerCase() && p.socketId !== socketId
  );
  if (nameTaken) return false;

  const existing = room.participants.find((p) => p.socketId === socketId);
  if (!existing) {
    room.participants.push({ socketId, displayName });
  }
  return true;
}

/**
 * Remove a participant from a room.
 * @param {object} room
 * @param {string} socketId
 * @returns {{ socketId: string, displayName: string }|null}
 */
export function removeParticipant(room, socketId) {
  const idx = room.participants.findIndex((p) => p.socketId === socketId);
  if (idx === -1) return null;
  const [removed] = room.participants.splice(idx, 1);
  room.votes.delete(socketId);
  return removed;
}

/**
 * Find which room a socket is in.
 * @param {string} socketId
 * @returns {object|null}
 */
export function findRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.participants.some((p) => p.socketId === socketId)) {
      return room;
    }
  }
  return null;
}

/**
 * Serialize votes for a room:state event (boolean map — voted or not).
 * @param {object} room
 * @returns {object}
 */
export function serializeVotesHidden(room) {
  const result = {};
  for (const [socketId] of room.votes) {
    result[socketId] = true;
  }
  return result;
}

/**
 * Serialize votes for a vote:revealed event (full values with displayName).
 * @param {object} room
 * @returns {object}
 */
export function serializeVotesRevealed(room) {
  const result = {};
  for (const [socketId, value] of room.votes) {
    const participant = room.participants.find((p) => p.socketId === socketId);
    result[socketId] = {
      displayName: participant ? participant.displayName : 'Unknown',
      value,
    };
  }
  return result;
}

/**
 * Build a room:state payload.
 * @param {object} room
 * @returns {object}
 */
export function buildRoomState(room) {
  return {
    roomId: room.roomId,
    hostSocketId: room.hostSocketId,
    participants: room.participants.map((p) => ({ socketId: p.socketId, displayName: p.displayName })),
    votes: serializeVotesHidden(room),
    revealed: room.revealed,
  };
}

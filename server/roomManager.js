/**
 * roomManager.js
 * Manages in-memory room state for Planning Poker.
 * Adds host tracking, timer configuration, and timer state.
 */

const rooms = {};

function createRoom(roomId) {
  return {
    id: roomId,
    sockets: [],
    votes: {},
    votingLocked: false,
    hostSocketId: null,
    timerConfig: { durationMs: 60000 },
    timerState: {
      running: false,
      startedAt: null,
      durationMs: 60000,
      remainingAtPause: null,
      pausedAt: null,
      intervalId: null,
    },
  };
}

function getOrCreateRoom(roomId) {
  if (!rooms[roomId]) rooms[roomId] = createRoom(roomId);
  return rooms[roomId];
}

function assignHost(room) {
  room.hostSocketId = room.sockets.length > 0 ? room.sockets[0] : null;
}

function joinRoom(roomId, socketId) {
  const room = getOrCreateRoom(roomId);
  if (!room.sockets.includes(socketId)) room.sockets.push(socketId);
  assignHost(room);
  return room;
}

function leaveRoom(roomId, socketId) {
  const room = rooms[roomId];
  if (!room) return null;
  room.sockets = room.sockets.filter((id) => id !== socketId);
  delete room.votes[socketId];
  if (room.sockets.length === 0) {
    if (room.timerState.intervalId) clearInterval(room.timerState.intervalId);
    delete rooms[roomId];
    return null;
  }
  assignHost(room);
  return room;
}

function allVoted(room) {
  if (room.sockets.length === 0) return false;
  return room.sockets.every((id) => room.votes[id] !== undefined);
}

function getTimerStatePayload(room) {
  const { running, startedAt, durationMs, remainingAtPause, pausedAt } = room.timerState;
  return { running, startedAt, durationMs, remainingAtPause, pausedAt };
}

function getRoomStatePayload(room) {
  return {
    roomId: room.id,
    sockets: room.sockets,
    votes: room.votes,
    votingLocked: room.votingLocked,
    hostSocketId: room.hostSocketId,
    timerConfig: room.timerConfig,
    timerState: getTimerStatePayload(room),
  };
}

module.exports = {
  rooms,
  getOrCreateRoom,
  createRoom,
  assignHost,
  joinRoom,
  leaveRoom,
  allVoted,
  getTimerStatePayload,
  getRoomStatePayload,
};
/**
 * roomState.js
 *
 * Factory function for creating a new server-side room object.
 * Extended for issue #10 to include timer-related fields.
 */

'use strict';

/**
 * Create a fresh room-state object.
 * @param {string} roomId          - Unique room identifier.
 * @param {string} hostSocketId   - SocketId of the first participant.
 * @returns {object}
 */
function createRoom(roomId, hostSocketId) {
  return {
    id: roomId,
    hostId: hostSocketId || null,
    participants: hostSocketId ? [hostSocketId] : [],
    votes: new Map(),
    votesRevealed: false,
    votingLocked: false,
    // Timer state (issue #10)
    timerEndsAt: null,
    timerActive: false,
    timerPaused: false,
    timerDuration: 60,
    timerRemainingMs: null,
    timerInterval: null,
  };
}

/**
 * Promote the next oldest participant to host when the current host leaves.
 * @param {object} room           - Room state object.
 * @param {string} disconnectedId - SocketId of the leaving socket.
 */
function handleParticipantLeave(room, disconnectedId) {
  room.participants = room.participants.filter((id) => id !== disconnectedId);
  room.votes.delete(disconnectedId);
  if (room.hostId === disconnectedId) {
    room.hostId = room.participants[0] || null;
  }
}

module.exports = { createRoom, handleParticipantLeave };
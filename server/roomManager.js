/**
 * roomManager.js  -- extended with timer and host support (issue #10)
 *
 * Keeps a Map of plain JS objects representing rooms.
 * Each room now carries a hostSocketId and a timer sub-object.
 *
 * AC1 -- first socket to join is host; re-assigned on disconnect.
 * AC6 -- full timer state is server-side, sent to late-joiners.
 */

'use strict';

const { createTimer } = require('./timerController');

class RoomManager {
  constructor() {
    /** @type {Map<string, Object>} */
    this.rooms = new Map();
  }

  // ---------------------------------------------------------
  // Room lifecycle
  // ---------------------------------------------------------

  /**
   * Get or create a room.
   * @param {string} roomId
   * @returns {Object} room
   */
  getOrCreateRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        // Participants is an ordered array of { socketId, name, vote }
        participants: [],
        revealed: false,
        // --- timer fields (AC1, AC6) ---
        hostSocketId: null,
        timer: createTimer(),
      });
    }
    return this.rooms.get(roomId);
  }

  /**
   * Return an existing room or undefined.
   * @param {string} roomId
   */
  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  /**
   * Destroy a room (e.g. no participants left).
   * @param {string} roomId
   */
  deleteRoom(roomId) {
    this.rooms.delete(roomId);
  }

  // ---------------------------------------------------------
  // Participant management
  // ---------------------------------------------------------

  /**
   * Add a participant to a room. First participant becomes host (AC1).
   * @param {string} roomId
   * @param {string} socketId
   * @param {string} name
   */
  addParticipant(roomId, socketId, name) {
    const room = this.getOrCreateRoom(roomId);
    room.participants.push({ socketId, name, vote: null });
    // AC1: first socket to join is the host
    if (room.hostSocketId === null) {
      room.hostSocketId = socketId;
    }
    return room;
  }

  /**
   * Remove a participant. Re-assigns host to next oldest member if needed (AC1).
   * @param {string} socketId
   * @returns {string|null} roomId the participant was in, or null
   */
  removeParticipant(socketId) {
    for (const [roomId, room] of this.rooms) {
      const idx = room.participants.findIndex((p) => p.socketId === socketId);
      if (idx === -1) continue;

      room.participants.splice(idx, 1);

      // AC1: re-assign host if the leaving socket was the host
      if (room.hostSocketId === socketId) {
        room.hostSocketId =
          room.participants.length > 0
            ? room.participants[0].socketId
            : null;
      }

      // Clean up empty rooms
      if (room.participants.length === 0) {
        this.deleteRoom(roomId);
      }

      return roomId;
    }
    return null;
  }

  /**
   * Record a vote for a participant.
   * @param {string} roomId
   * @param {string} socketId
   * @param {*} vote
   * @returns {boolean} true if all participants have now voted
   */
  recordVote(roomId, socketId, vote) {
    const room = this.getRoom(roomId);
    if (!room) return false;
    const p = room.participants.find((x) => x.socketId === socketId);
    if (p) p.vote = vote;
    return room.participants.every((x) => x.vote !== null);
  }

  /**
   * Reset all votes in a room.
   * @param {string} roomId
   */
  resetVotes(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return;
    room.participants.forEach((p) => {
      p.vote = null;
    });
    room.revealed = false;
  }
}

module.exports = new RoomManager();

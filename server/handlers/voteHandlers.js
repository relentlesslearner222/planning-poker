import {
  getRoom,
  findRoomBySocket,
  buildRoomState,
  serializeVotesHidden,
  serializeVotesRevealed,
} from '../rooms.js';
import { cancelTimer } from './timerHandlers.js';

const VALID_VALUES = new Set(['1', '2', '3', '5', '8', '13', '21', '?', '☕']);

export function registerVoteHandlers(io, socket) {
  /** vote:submit — a player submits their card */
  socket.on('vote:submit', ({ value }) => {
    const room = findRoomBySocket(socket.id);
    if (!room) {
      socket.emit('room:error', { message: 'You are not in a room.' });
      return;
    }
    if (room.revealed) {
      socket.emit('room:error', { message: 'Votes have already been revealed.' });
      return;
    }
    if (!VALID_VALUES.has(value)) {
      socket.emit('room:error', { message: `Invalid vote value: ${value}` });
      return;
    }

    room.votes.set(socket.id, value);

    io.to(room.roomId).emit('vote:updated', {
      votes: serializeVotesHidden(room),
    });

    console.log(`[vote] ${socket.id} voted in ${room.roomId}`);
  });

  /** vote:reveal — host reveals all votes */
  socket.on('vote:reveal', () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    if (socket.id !== room.hostSocketId) {
      socket.emit('room:error', { message: 'Only the host can reveal votes.' });
      return;
    }
    if (room.revealed) return;

    room.revealed = true;
    cancelTimer(room);

    io.to(room.roomId).emit('vote:revealed', {
      votes: serializeVotesRevealed(room),
    });

    console.log(`[vote] revealed in ${room.roomId}`);
  });

  /** round:reset — host starts a new round */
  socket.on('round:reset', () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    if (socket.id !== room.hostSocketId) {
      socket.emit('room:error', { message: 'Only the host can reset the round.' });
      return;
    }

    room.votes.clear();
    room.revealed = false;
    cancelTimer(room);

    io.to(room.roomId).emit('room:state', buildRoomState(room));
    // Sync timer as stopped
    io.to(room.roomId).emit('timer:sync', {
      remaining: 0,
      running: false,
      totalDuration: 0,
    });

    console.log(`[vote] round reset in ${room.roomId}`);
  });
}

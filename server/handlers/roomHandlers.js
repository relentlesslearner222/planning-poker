import { nanoid } from 'nanoid';
import {
  createRoom,
  getRoom,
  addParticipant,
  removeParticipant,
  findRoomBySocket,
  buildRoomState,
  deleteRoom,
} from '../rooms.js';
import { cancelTimer } from './timerHandlers.js';

export function registerRoomHandlers(io, socket) {
  /** room:create — host creates a new room */
  socket.on('room:create', () => {
    const roomId = nanoid(8);
    createRoom(roomId, socket.id);
    socket.emit('room:created', { roomId });
    console.log(`[room] created ${roomId} by ${socket.id}`);
  });

  /** room:join — any player joins a room */
  socket.on('room:join', ({ roomId, displayName }) => {
    if (!roomId || !displayName || !displayName.trim()) {
      socket.emit('room:error', { message: 'Room ID and display name are required.' });
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      socket.emit('room:error', { message: 'Room not found. Check your invite link.' });
      return;
    }

    const joined = addParticipant(room, socket.id, displayName.trim());
    if (!joined) {
      socket.emit('room:error', { message: 'That name is already taken in this room.' });
      return;
    }

    socket.join(roomId);

    // Send full state to all room members
    io.to(roomId).emit('room:state', buildRoomState(room));
    console.log(`[room] ${displayName} (${socket.id}) joined ${roomId}`);
  });

  /** disconnect — clean up participant from any room they were in */
  socket.on('disconnect', () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    const removed = removeParticipant(room, socket.id);
    if (!removed) return;

    console.log(`[room] ${removed.displayName} (${socket.id}) left ${room.roomId}`);

    // Stop timer if host left or room is empty
    if (room.participants.length === 0) {
      cancelTimer(room);
      deleteRoom(room.roomId);
      return;
    }

    // If host disconnected, assign new host
    if (room.hostSocketId === socket.id) {
      room.hostSocketId = room.participants[0].socketId;
      console.log(`[room] new host: ${room.hostSocketId}`);
    }

    io.to(room.roomId).emit('room:participant-left', {
      socketId: removed.socketId,
      displayName: removed.displayName,
    });

    // Broadcast updated state so clients re-render
    io.to(room.roomId).emit('room:state', buildRoomState(room));
  });
}

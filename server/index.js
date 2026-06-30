const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { createRoomManager } = require('./roomManager');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());

// Serve built client in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const roomManager = createRoomManager(io);

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  // ── Room lifecycle ──────────────────────────────────────────────────
  socket.on('room:join', ({ roomId, userName }) => {
    roomManager.joinRoom(socket, roomId, userName);
  });

  socket.on('room:leave', () => {
    roomManager.leaveRoom(socket);
  });

  // ── Voting ──────────────────────────────────────────────────────────
  socket.on('vote:cast', ({ value }) => {
    roomManager.castVote(socket, value);
  });

  socket.on('vote:reveal', () => {
    roomManager.revealVotes(socket);
  });

  socket.on('vote:reset', () => {
    roomManager.resetVotes(socket);
  });

  // ── Timer ───────────────────────────────────────────────────────────
  socket.on('timer:start', ({ durationMs }) => {
    roomManager.startTimer(socket, durationMs);
  });

  socket.on('timer:cancel', () => {
    roomManager.cancelTimer(socket);
  });

  // ── Disconnect ──────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${socket.id}`);
    roomManager.leaveRoom(socket);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Planning Poker server listening on http://localhost:${PORT}`);
});

module.exports = { app, httpServer, io };

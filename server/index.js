import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerRoomHandlers } from './handlers/roomHandlers.js';
import { registerVoteHandlers } from './handlers/voteHandlers.js';
import { registerTimerHandlers } from './handlers/timerHandlers.js';

const PORT = process.env.PORT || 3001;

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
  },
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  registerRoomHandlers(io, socket);
  registerVoteHandlers(io, socket);
  registerTimerHandlers(io, socket);

  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});

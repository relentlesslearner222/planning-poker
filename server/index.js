const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// rooms[roomId] = { participants, votes, revealed, hostId,
//                   timerDuration, remainingSeconds, timerState, timerInterval }
const rooms = {};

// ---------- helpers ----------

function buildRoomUpdate(room) {
  return {
    participants: room.participants,
    votes: room.revealed
      ? room.votes
      : Object.fromEntries(
          Object.keys(room.votes).map((id) => [id, room.votes[id] !== null])
        ),
    revealed: room.revealed,
    hostId: room.hostId,
    timerDuration: room.timerDuration,
    remainingSeconds: room.remainingSeconds,
    timerState: room.timerState,
  };
}

function broadcastRoom(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  io.to(roomId).emit("roomUpdate", buildRoomUpdate(room));
}

function allVoted(room) {
  const participants = room.participants;
  if (!participants || participants.length === 0) return false;
  return participants.every((p) => room.votes[p.id] !== null && room.votes[p.id] !== undefined);
}

function revealVotes(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  room.revealed = true;
  broadcastRoom(roomId);
}

function clearTimer(room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
}

function startTick(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  clearTimer(room);
  room.timerInterval = setInterval(() => {
    const r = rooms[roomId];
    if (!r) { clearInterval(room.timerInterval); return; }

    r.remainingSeconds = Math.max(0, r.remainingSeconds - 1);
    broadcastRoom(roomId);

    if (r.remainingSeconds === 0) {
      clearTimer(r);
      r.timerState = "expired";
      revealVotes(roomId);
    }
  }, 1000);
}

// ---------- connection ----------

io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  // joinRoom
  socket.on("joinRoom", ({ roomId, name }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        participants: [],
        votes: null,
        revealed: false,
        hostId: socket.id,
        timerDuration: 60,
        remainingSeconds: 60,
        timerState: "idle",
        timerInterval: null,
      };
    }

    const room = rooms[roomId];

    if (!room.votes) room.votes = {};

    if (!room.participants.find((p) => p.id === socket.id)) {
      room.participants.push({ id: socket.id, name });
      room.votes[socket.id] = null;
    }

    broadcastRoom(roomId);
  });

  // submitVote
  socket.on("submitVote", ({ roomId, vote }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.timerState === "expired") return;

    room.votes[socket.id] = vote;
    broadcastRoom(roomId);

    if (allVoted(room) && !room.revealed) {
      clearTimer(room);
      room.timerState = "expired";
      revealVotes(roomId);
    }
  });

  // revealVotes (manual)
  socket.on("revealVotes", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    clearTimer(room);
    room.timerState = "expired";
    revealVotes(roomId);
  });

  // resetRoom
  socket.on("resetRoom", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    clearTimer(room);
    room.votes = Object.fromEntries(room.participants.map((p) => [p.id, null]));
    room.revealed = false;
    room.timerState = "idle";
    room.remainingSeconds = room.timerDuration;
    broadcastRoom(roomId);
  });

  // timer:configure
  socket.on("timer:configure", ({ roomId, duration }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.hostId !== socket.id) return;
    if (room.timerState !== "idle") return;
    const d = parseInt(duration, 10);
    if (isNaN(d) || d < 10 || d > 300) return;
    room.timerDuration = d;
    room.remainingSeconds = d;
    broadcastRoom(roomId);
  });

  // timer:start
  socket.on("timer:start", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.hostId !== socket.id) return;
    if (room.timerState !== "idle") return;
    room.timerState = "running";
    broadcastRoom(roomId);
    startTick(roomId);
  });

  // timer:pause
  socket.on("timer:pause", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.hostId !== socket.id) return;
    if (room.timerState !== "running") return;
    clearTimer(room);
    room.timerState = "paused";
    broadcastRoom(roomId);
  });

  // timer:resume
  socket.on("timer:resume", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.hostId !== socket.id) return;
    if (room.timerState !== "paused") return;
    room.timerState = "running";
    broadcastRoom(roomId);
    startTick(roomId);
  });

  // timer:reset
  socket.on("timer:reset", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.hostId !== socket.id) return;
    clearTimer(room);
    room.remainingSeconds = room.timerDuration;
    room.timerState = "idle";
    broadcastRoom(roomId);
  });

  // disconnect
  socket.on("disconnect", () => {
    console.log("disconnected:", socket.id);
    for (const roomId of Object.keys(rooms)) {
      const room = rooms[roomId];
      const idx = room.participants.findIndex((p) => p.id === socket.id);
      if (idx === -1) continue;

      room.participants.splice(idx, 1);
      delete room.votes[socket.id];

      // AC-2: promote next oldest participant as host
      if (room.hostId === socket.id) {
        room.hostId = room.participants.length > 0 ? room.participants[0].id : null;
      }

      if (room.participants.length === 0) {
        clearTimer(room);
        delete rooms[roomId];
      } else {
        broadcastRoom(roomId);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
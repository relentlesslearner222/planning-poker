# Planning Poker -- Timer Based

A real-time, timer-based planning poker app built with React (frontend) and Node.js / Socket.IO (backend).

---

## Features

- Create and join rooms with 8-character shareable room codes
- Configurable countdown timer per room: 30s, 1min, 1.5min, 2min, 3min
- Auto-reveal when timer hits 0 OR all participants have voted
- Host controls: Start, Pause, Resume, manual Reveal, Next Round
- Fibonacci card deck: 0, 1, 2, 3, 5, 8, 13, 21, 40, 80, ?
- Live results: Average, Median, Min, Max from numeric votes
- Larticipant list with live voted/waiting status
- Auto host transfer if host disconnects

---

## Project Structure

```
planning-poker/
-- server/index.js          # Express + Socket.IO server
-- client/src/
   -- hooks/useSocket.js
   -- components/
      -- Lobby, Room, Timer, VotingCards, Participants, Results
```

---

## Quick Start

```bash
# install server deps
npm install

# install client deps
cd client && npm install && cd ..

# run both
"npm run dev"
```

- Backend: http://localhost:4000
- Frontend: http://localhost:3000

---

## Socket.IO Events

### Client to Server

| Event | Payload | Description |
|---|---|---|
| `create-room` | name, userName, timerDuration | Create a new room |
| `join-room` | roomId, userName | Join existing room |
| `submit-vote` | roomId, vote | Cast a vote |
| `start-timer` | roomId, topic | Host starts countdown |
| `pause-timer` | roomId | Host pauses countdown |
| `resume-timer` | roomId | Host resumes countdown |
| `reveal-votes` | roomId | Host manually reveals |
| reset-round | roomId, timerDuration | Host resets for next round |

### Server to Client

| Event | Description |
|---|---|
| room-created | Fired to creator with initial state |
| joined-room | Fired to joiner with current state |
| room-updated | Broadcast on participant change or vote |
| timer-started | Broadcast when timer begins |
| timer-tick | Every second with remaining time |
| timer-expired | Timer hit 0, votes auto-revealed |
| timer-paused | Broadcast when paused |
| timer-resumed | Broadcast when resumed |
| votes-revealed | Votes are now visible |

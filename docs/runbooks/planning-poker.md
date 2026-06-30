# Runbook: Planning Poker

## Overview
Real-time agile estimation tool. Engineers join a room and vote on story point estimates simultaneously. A host controls a visible countdown timer. Built with Socket.io (server) + React/Vite (client).

## Architecture
```
┌──────────────────────┐        WebSocket / Socket.io
│   React Client       │◄──────────────────────────────►│ Node.js Server │
│   (Vite, port 3001)  │                                  │ (Express+Socket.io, port 3000) │
└──────────────────────┘                                  └───────────────┘
```

In production, Vite builds static assets which are served by the Express server on port 3000.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `NODE_ENV` | `development` | Set to `production` to serve static client |
| `VITE_SERVER_URL` | `/` | Client-side: Socket.io server URL (set for dev cross-origin) |

## Running Locally (Development)

```bash
# Install deps
npm install

# Start both server (port 3000) and client dev server (port 3001) with hot reload
npm run dev

# Open http://localhost:3001
```

The Vite dev server proxies `/socket.io` requests to `http://localhost:3000`.

## Running Locally (Production Build)

```bash
npm run build        # produces dist/
NODE_ENV=production node server/index.js
# Open http://localhost:3000
```

## Running Tests

```bash
npm test             # run all Jest tests
npm run test:watch   # watch mode
```

Test coverage:
- `server/__tests__/roomManager.test.js` — room lifecycle, voting, timer, host re-assignment
- `client/src/components/__tests__/` — FibonacciDeck, ParticipantList, TimerDisplay, Lobby

## Socket.io Protocol

### Client → Server
| Event | Payload | Who |
|---|---|---|
| `room:join` | `{ roomId, userName }` | Any |
| `room:leave` | — | Any |
| `vote:cast` | `{ value: string }` | Any |
| `vote:reveal` | — | Host only |
| `vote:reset` | — | Host only |
| `timer:start` | `{ durationMs: number }` | Host only |
| `timer:cancel` | — | Host only |

### Server → Client
| Event | Payload | Description |
|---|---|---|
| `room:joined` | `{ roomId, isHost }` | Confirms join |
| `room:state` | `{ roomId, hostId, participants[], revealed }` | Full room snapshot |
| `timerSync` | `{ remaining, running, totalDuration }` | Timer tick (200 ms interval) |
| `vote:revealed` | `{ participants[] }` | Full votes on reveal |
| `error` | `{ message }` | Server-side validation error |

## Fibonacci Deck Values
`0, 1, 2, 3, 5, 8, 13, 21, ?, ☕`

## Failure Modes

| Symptom | Likely cause | Fix |
|---|---|---|
| Client shows "Connecting…" | Server not running | Start server with `npm run dev:server` |
| Timer won't start | Not the room host | Only the first joiner (host) controls the timer |
| Votes stuck after reveal | Normal — host must click **New Round** | Click New Round |
| Room disappears | Last participant left — rooms are in-memory | Re-create the room |
| Old vote shown after reconnect | Browser state stale | Refresh page and rejoin |

## Scaling Considerations
- Room state is in-memory. For multi-instance deployments, add Socket.io Redis adapter (`@socket.io/redis-adapter`) and a Redis-backed room store.
- No auth — room IDs are the only access control. For internal use only.

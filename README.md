# 🏲 Planning Poker

A real-time, multiplayer Planning Poker application built for remote sprint planning sessions. The React frontend lets team members join a named room, cast Fibonacci-scale story point votes (1, 2, 3, 5, 8, 13), and see everyone’s results together when votes are revealed -- all powered by a Node.js + Socket.io backend that maintains in-memory rooms supporting up to 20 participants each.

## Quick Start

```bash
# Install dependencies (requires Yarn workspaces)
yarn install

# Run both server (port 3001) and client (port 3000) concurrently
yarn dev
```

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | React 18, Socket.io-client        |
| Backend  | Node.js, Express, Socket.io       |
| State    | In-memory Map (no database needed)|

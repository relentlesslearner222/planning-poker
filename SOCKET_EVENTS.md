# Socket.io Events Documentation

This file documents all Socket.io events used in the Planning Poker application.

---

## Timer Events (added in v2 -- timer-based planning poker)

### Client → Server

| Event Name | Payload | Description | Host Only |
|------------|--------|-------------|-----------|
| `timer:configure` | `{ durationSeconds: number }` | Sets the timer duration (60 –600 seconds / 1–10 minutes). Ignored while timer is running. | Yes |
| `timer:start` | _(no payload)_ | Starts or resumes the countdown. | Yes |
| `timer:pause` | _(no payload)_ | Pauses the running countdown. | Yes |
| `timer:reset` | _(no payload)_ | Resets remaining time to the configured duration and stops the timer. | Yes |

### Server → Client (broadcast to all room participants)

| Event Name | Payload | Description |
|------------|--------|--------------|
| `timer:tick` | `{ remainingSeconds: number, running: boolean }` | Broadcast every second while the timer is running. Clients should update their local display. |
| `timer:expired` | _(no payload)_ | Emitted when the countdown reaches zero. Voting is locked and votes are auto-revealed. |
| `timer:updated` | `{ durationSeconds: number, remainingSeconds: number, running: boolean, paused: boolean }` | Full timer state. Sent to a client on join, and broadcast to all on reset or configure. |

---

## Payload Types

```ts
// timer:configure
{ durationSeconds: number } // 60–600 (1–10 minutes)

// timer:tick
{ remainingSeconds: number; running: boolean }

// timer:updated
{
  durationSeconds: number;
  remainingSeconds: number;
  running: boolean;
  paused: boolean;
}
```

---

## Host Assignment

- The first socket to join a room is designated the **host/moderator**.
- If the host disconnects, the next oldest member in the room is promoted.
- Host status is communicated to the client via the existing room-state payload (`hostId` field).
- Only the host may emit `timer:configure`, `timer:start`, `timer:pause`, and `timer:reset`. Server enforces this and silently ignores unauthorized calls.

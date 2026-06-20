# Timer-Based Planning Poker — Feature Documentation

## Overview
Adds a countdown timer to planning poker. When timer expires, votes are automatically revealed.

---

## Components

### PokerTimer
File: `src/components/PokerTimer.jsx`

Props:
- `durationSeconds` (number, default 60) - Total countdown duration
- `isHost` (boolean, default false) - Show control buttons
- `onExpire` (function) - Callback when timer reaches zero
- `warnAtSeconds` (number, default 10) - Seconds remaining before warning

Behaviour:
- Displays time as MM:SS
- Pulses red when warnAtSeconds remaining
- Shows expired message on zero
- Host-only Start/Pause/Reset controls

---

### TimerPokerRoom
File: `src/components/TimerPokerRoom.jsx`

Props:
- `roomName` (string, default 'Story #1') - Current story name
- `isHost` (boolean, default true) - Host privileges
- `timerDuration` (number, default 60) - Timer duration in seconds
- `participants` (array) - Array of {id, name, vote} objects

---

## Usage

```jsx
import TimerPokerRoom from './components/TimerPokerRoom';

<TimerPokerRoom
  roomName="Implement login flow"
  isHost={true}
  timerDuration={90}
  participants={[
    { id: 1, name: 'Alice', vote: '5' },
    { id: 2, name: 'Bob',   vote: '8' },
  ]}
/>
```

---

## Design Decisions
- Auto-reveal on expiry: ensures time-boxed rounds
- Host-only controls: prevents participants disrupting sessions
- CSS pulse animation: visual low-time warning without audio permissions

---

## Future Enhancements
- WebSocket sync for multiplayer timer state
- Configurable warnAtSeconds via room settings
- Opt-in audio beep in final 5 seconds
- localStorage persistence for page refresh
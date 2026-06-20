# Timer-Based Planning Poker

## Overview
This feature adds a countdown-timer-driven Planning Poker session to the app.
Players must submit their story-point estimate before the timer expires.
When time runs out, votes are automatically revealed.

---

## Files Added

| File | Purpose |
|-----|--------|
| `src/components/TimerPoker.js` | Main React component - timer display, card selection, host controls |
| `src/components/TimerPoker.css` | Scoped styles, low-time pulse animation, responsive grid |
| `src/hooks/usePokerTimer.js`   | Custom hook - all timer state, start / pause / reset logic |

---

## Usage

```jsx
import TimerPoker from './components/TimerPoker';

// Basic usage (host view, 60-second default)
<TimerPoker />

// Custom duration, non-host participant
<TimerPoker isHost={false} initialDuration={90} />
```

### Props

| Prop | Type | Default | Description |
|-----|-----|--------|------------|
| `isHost` | `boolean` | `true` | Shows/hides Start, Pause, Reset, and Reveal controls |
| `initialDuration` | `number` | `60` | Countdown duration in seconds (10-300) |

---

## Hook API - `usePokerTimer(duration, onExpire)`

| Return | Type | Description |
|-------|-----|------------|
| `timeLeft` | `number` | Remaining seconds |
| `isRunning` | `boolean` | Whether the timer is ticking |
| `start()` | `function` | Begin or resume countdown |
| `pause()` | `function` | Pause countdown |
| `reset()` | `function` | Reset to initial duration and stop |

---

## Behaviour

- **Countdown** from configurable duration (default 60 s, range 10-300 s).
- **Auto-reveal** - votes are exposed when timer hits 0.
- **Low-time warning** - pulsing red background and Hurry up! text when 10 s or less remain.
- **Host controls** - Start / Pause / Reset / Manual Reveal; hidden for non-host participants.
- **Fibonacci cards** - 1, 2, 3, 5, 8, 13, 21, ?

---

## Future Enhancements
- WebSocket sync so all participants share the same timer state.
- Persistent session state via localStorage or a backend.
- Sound alert on low-time warning.
- Multi-round scoring summary view.

---

Closes #11
import { useState } from 'react';

/**
 * TimerControls -- rendered exclusively for the room host.
 *
 * Props:
 *   socket         {Socket}   Socket.io client instance
 *   isTimerActive {boolean}  whether a countdown is currently running
 */
export default function TimerControls({ socket, isTimerActive }) {
  const [durationSec, setDurationSec] = useState(60); // default 60s

  function handleStart() {
    // Client-side clamp [10, 300] seconds (server revalidates)
    const secs = Math.min(Math.max(durationSec, 10), 300);
    socket.emit('timer:start', { durationMs: secs * 1000 });
  }

  function handleCancel() {
    socket.emit('timer:cancel');
  }

  return (
    <div className="timer-controls flex items-center gap-3 flex-wrap">
      <label htmlFor="timer-duration">
        Timer duration (seconds):
      </label>
      <input
        id="timer-duration"
        type="number"
        min={10}
        max={300}
        value={durationSec}
        onChange={(e) => setDurationSec(Number(e.target.value))}
        disabled={isTimerActive}
      />
      {!isTimerActive ? (
        <button
          onClick={handleStart}
          className="bg-brand-primary hover:bg-brand-dark text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
        >
          Start Timer
        </button>
      ) : (
        <button
          onClick={handleCancel}
          className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
        >
          Cancel Timer
        </button>
      )}
    </div>
  );
}

import React, { useState } from 'react';

/**
 * TimerControls -- rendered exclusively for the room host. (AC2)
 *
 * Props:
 *   socket         {Socket}   Socket.io client instance
 *   isTimerActive {boolean}  whether a countdown is currently running
 */
export default function TimerControls({ socket, isTimerActive }) {
  const [durationSec, setDurationSec] = useState(60); // default 60 
  
  function handleStart() {
    // AC2: client-side clamp [10, 300] seconds (server revalidates)
    const secs = Math.min(Math.max(durationSec, 10), 300);
    socket.emit('timer:start', { durationMs: secs * 1000 });
  }

  function handleCancel() {
    socket.emit('timer:cancel');
  }

  return (
    <div className="timer-controls">
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
        <button onClick={handleStart}>Start Timer</button>
      ) : (
        <button onClick={handleCancel}>Cancel Timer</button>
      )}
    </div>
  );
}
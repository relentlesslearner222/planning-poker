import React, { useState } from 'react';

/**
 * TimerControls -- rendered exclusively for the room host.
 *
 * Props:
 *   socket         {Socket}   Socket.io client instance
 *   isTimerActive {boolean}  whether a countdown is currently running
 */
export default function TimerControls({ socket, isTimerActive }) {
  const [durationSec, setDurationSec] = useState(60);

  function handleStart() {
    // Client-side clamp [10, 300] seconds (server revalidates)
    const secs = Math.min(Math.max(durationSec, 10), 300);
    socket.emit('timer:start', { durationMs: secs * 1000 });
  }

  function handleCancel() {
    socket.emit('timer:cancel');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1rem' }}>
      <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
        Duration (seconds)
        <input
          type="number"
          min={10}
          max={300}
          value={durationSec}
          onChange={(e) => setDurationSec(Number(e.target.value))}
          disabled={isTimerActive}
          style={{
            display: 'block',
            marginTop: '0.25rem',
            padding: '0.4rem 0.6rem',
            borderRadius: '6px',
            border: '1.5px solid #ced4da',
            width: '100%',
            fontSize: '0.9rem'
          }}
        />
      </label>
      {!isTimerActive ? (
        <button
          onClick={handleStart}
          style={{
            padding: '0.45rem',
            borderRadius: '6px',
            border: 'none',
            background: '#428ca8',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.88rem'
          }}
        >
          Start Timer
        </button>
      ) : (
        <button
          onClick={handleCancel}
          style={{
            padding: '0.45rem',
            borderRadius: '6px',
            border: 'none',
            background: '#e03131',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.88rem'
          }}
        >
          Cancel Timer
        </button>
      )}
    </div>
  );
}

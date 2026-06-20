import React, { useState } from 'react';
import '../styles/timer.css';

// Preset timer durations available to the host (AC7)
const PRESET_DURATIONS = [
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '1m 30s', value: 90 },
  { label: '2m', value: 120 },
];

/**
 * TimerControls
 * --------------------------------------------------------------
 * Rendered **only for the room host** (AC2).
 * Allows the host to select a duration (preset or custom) and
 * Start / Pause / Reset the server-side timer.
 *
 * Socket events emitted:
 *   timer:configure  { duration: number }    -- set duration
 *   timer:start      {}                      -- begin countdown
 *   timer:pause      {}                      -- pause countdown
 *   timer:reset      {}                      -- reset to configured duration
 *
 * @param {object} socket    Socket.io client instance
 * @param {string} roomId    Current room identifier
 * @param {string} status    Current server timer status
 */
export default function TimerControls({ socket, roomId, status }) {
  // Selected preset or custom duration in seconds
  const [duration, setDuration] = useState(60);

  // Raw text for the custom input field
  const [customInput, setCustomInput] = useState('');

  // ---- Emit helpers ----

  /** Broadcast chosen duration to the server so all peers see it */
  const handleConfigure = (secs) => {
    const value = parseInt(secs, 10);
    if (!Number.isFinite(value) || value <= 0) return;
    setDuration(value);
    socket.emit('timer:configure', { roomId, duration: value });
  };

  const handleStart = () => socket.emit('timer:start', { roomId });
  const handlePause = () => socket.emit('timer:pause', { roomId });
  const handleReset = () => socket.emit('timer:reset', { roomId });

  const isRunning = status === 'running';
  const isFinished = status === 'expired' || status === 'stopped';

  return (
    <div className="timer-controls" role="region" aria-label="Timer controls">
      <h1>Timer Settings</h1>

      {/* Preset duration buttons (AC7) */}
      <div className="timer-controls__presets" aria-label="Preset durations">
        {PRESET_DURATIONS.map(({ label, value }) => (
          <button
            key={value}
            className={`timer-controls__preset${duration === value ? ' active' : ''}`}
            onClick={() => handleConfigure(value)}
            disabled={isRunning || isFinished}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Custom duration input (AC7) */}
      <div className="timer-controls__custom">
        <label htmlFor="timer-custom-input">Custom (seconds):</label>
        <input
          id="timer-custom-input"
          type="number"
          min="5"
          max="3600"
          placeholder="e.g. 45"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          disabled={isRunning || isFinished}
        />
        <button
          onClick={() => { handleConfigure(customInput); setCustomInput(''); }}
          disabled={!customInput || isRunning || isFinished}
        >
          Set
        </button>
      </div>

      {/* Playback controls */}
      <div className="timer-controls__actions">
        {!isRunning && !isFinished && (
          <button className="timer-controls__btn timer-controls__btn--start" onClick={handleStart}>
            &#123e; Start
          </button>
        )}
        {isRunning && (
          <button className="timer-controls__btn timer-controls__btn--pause" onClick={handlePause}>
            &#124;&#124; Pause
          </button>
        )}
        <button
          className="timer-controls__btn timer-controls__btn--reset"
          onClick={handleReset}
          disabled={status === 'idle'}
        >
          &#°; Reset
        </button>
      </div>
    </div>
  );
}

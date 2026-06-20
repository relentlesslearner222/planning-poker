import React, { useState } from 'react';
import './TimerPanel.css';

/**
 * TimerPanel
 * Props:
 *   isHost           : boolean
 *   timerState       : { status: string, remainingSeconds: number, duration: number }
 *   onStart          : () => void
 *   onPause          : () => void
 *   onReset          : () => void
 *   onConfigure      : (durationSeconds: number) => void
 */
export default function TimerPanel({
  isHost = false,
  timerState = { status: 'idle', remainingSeconds: 60, duration: 60000 },
  onStart,
  onPause,
  onReset,
  onConfigure,
}) {
  const { status, remainingSeconds } = timerState;

  // Local duration input state (host only)
  const [inputSecs, setInputSecs] = useState(
    Math.round(timerState.duration / 1000)
  );

  // AC6 - urgent class when remaining <= 10s and timer is running
  const isUrgent = status === 'running' && remainingSeconds <= 10;

  // Format seconds as MM:SS
  const formatTime = (secs) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleConfigure = () => {
    const n = parseInt(inputSecs, 10);
    if (!isNaN(n) && n >= 5 && n <= 600) onConfigure(n);
  };

  return (
    <div className="timer-panel">
      {/* Countdown display - AC2 & AC6 */}
      <div className={`timer-display${isUrgent ? ' urgent' : ''}`}>
        {formatTime(remainingSeconds)}
      </div>

      {/* Status label */}
      <span className="timer-status">{status}</span>

      {/* Host-only duration config - AC2 */}
      {isHost && status !== 'running' && (
        <div className="timer-config">
          <label htmlFor="timer-duration">Duration (s):</label>
          <input
            id="timer-duration"
            type="number"
            min={5}
            max={600}
            value={inputSecs}
            onChange={(e) => setInputSecs(e.target.value)}
            onBlur={handleConfigure}
          />
        </div>
      )}

      {/* Host-only controls - AC2 */}
      {isHost && (
        <div className="timer-controls">
          {status !== 'running' && status !== 'expired' && (
            <button className="btn-start" onClick={onStart}>
              {status === 'paused' ? 'Resume' : 'Start'}
            </button>
          )}
          {status === 'running' && (
            <button className="btn-pause" onClick={onPause}>Pause</button>
          )}
          <button className="btn-reset" onClick={onReset}>Reset</button>
        </div>
      )}

      {!isHost && (
        <span className="host-badge">Waiting for host</span>
      )}
    </div>
  );
}
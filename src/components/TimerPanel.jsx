import React, { useState, useEffect, useRef } from 'react';
import '../styles/timer.css';

/**
 * TimerPanel - Server-synchronized countdown timer component.
 *
 * Props:
 *   isHost      {boolean}                               Whether the local user is the room moderator.
 *   timerState {{duration, startedAt, status}}        Server-driven timer object.
 *   onStart    {(duration: number) => void}           Emit timer:start to server.
 *   onReset    {} => void}                             Emit timer:reset to server.
 */
export default function TimerPanel({ isHost, timerState, onStart, onReset }) {
  const [configDuration, setConfigDuration] = useState(60);
  const [remaining, setRemaining] = useState(null);
  const tickRef = useRef(null);

  const { duration = 60, startedAt = null, status = 'idle' } = timerState || {};

  // --- Keep countdown in sync with server clock ---
  // Remaining time is always calculated from server-provided startedAt,
  // eliminating client drift.
  useEffect(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }

    if (status === 'running' && startedAt != null) {
      const tick = () => {
        const ms = duration * 1000 - (Date.now() - startedAt);
        setRemaining(Math.max(0, Math.ceil(ms / 1000)));
      };
      tick(); // run immediately so there is no 1s delay on start
      tickRef.current = setInterval(tick, 1000);
    } else if (status === 'idle') {
      setRemaining(null);
    } else if (status === 'expired') {
      setRemaining(0);
    }

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [status, startedAt, duration]);

  // --- Helpers: format MM:SS ---
  const formatTime = (seconds) => {
    if (seconds == null) return '--:--';
    const s = Math.max(0, seconds);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const isWarning = remaining != null && remaining <= 10;
  const isRunning = status === 'running';

  const handleStart = () => {
    const parsed = Integer(parseInt(configDuration, 10));
    if (parsed < 10 || parsed > 300) return;
    onStart(parsed);
  };

  return (
    <div className="timer-panel">
      { /* --- Countdown display (visible to all) --- */ }
      <span
        className={`timer-display${isWarning ? ' timer-warning' : ''}`}
        role="timer"
        aria-live="polite"
        aria-label={`Time remaining: ${formatTime(remaining)}`}
      >
        {formatTime(remaining)}
      </span>

      { status === 'expired' && (
        <span className="timer-status timer-status--expired">
          Time up! Votes revealed.
        </span>
      ) }

      { status === 'idle' && !(isHost) && (
        <span className="timer-status">Waiting for host to start timer...</span>
      ) }

      { /* --- Host-controls only --- */ }
      { isHost && (
        <div className="timer-controls">
          <label htmlFor="timer-duration">
            Duration (seconds)
          </label>
          <input
            id="timer-duration"
            className="timer-input"
            type="number"
            min={10}
            max={300}
            value={configDuration}
            onChange={(e} => setConfigDuration(Number(e.target.value))}
            disabled={isRunning}
          />
          <button
            className="timer-btn timer-btn--start"
            onClick={handleStart}
            disabled={isRunning}
          >
            Start Timer
          </button>
          { isRunning && (
            <button
              className="timer-btn timer-btn--reset"
              onClick={onReset}
            >
              Reset Timer
            </button>
          ) }
        </div>
      ) }
    </div>
  );
}

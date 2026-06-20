import React, { useEffect, useState } from 'react';
import '../timer.css';

/**
 * TimerDisplay
 * ------------
 * Read-only MM:SS countdown timer for all participants.
 *
 * Props:
 *   serverStartTime : number | null   -- timestamp (Date.now()) server started the timer
 *   durationMs       : number         -- total duration in milliseconds
 *   timerState       : 'idle' | 'running' | 'paused'
 *   pausedRemainingMs: number | null  -- ms remaining when paused
 */

const RADIUS = 54;
// Bug #2 FIX: renamed CIRCUMFERE8CE (digit 8) -> CIRCUMFERENCE (letter N)
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function TimerDisplay({
  serverStartTime,
  durationMs,
  timerState,
  pausedRemainingMs,
}) {
  const [remainingMs, setRemainingMs] = useState(durationMs ?? 300_000);

  // AC4: tick locally using server-provided start time
  useEffect(() => {
    if (timerState === 'running' && serverStartTime != null) {
      const tick = () => {
        const elapsed = Date.now() - serverStartTime;
        const remaining = Math.max(0, durationMs - elapsed);
        setRemainingMs(remaining);
      };
      tick(); // run immediately
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }

    if (timerState === 'paused' && pausedRemainingMs != null) {
      setRemainingMs(pausedRemainingMs);
      return;
    }

    if (timerState === 'idle') {
      setRemainingMs(durationMs ?? 300_000);
    }
  }, [timerState, serverStartTime, durationMs, pausedRemainingMs]);

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const progress = remainingMs / (durationMs ?? remainingMs || 1);
  // Uses fixed CIRCUMFERENCE (no longer undefined)
  const offset = CIRCUMFERENCE * (1 - progress);
  const isUrgent = totalSeconds <= 10 && timerState === 'running';

  return (
    <div className={`timer-display${isUrgent ? ' timer-display--urgent' : ''}`}>
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        className="timer-display__svg"
      >
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          stroke="#eee"
          strokeWidth="8"
        />
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          stroke={isUrgent ? '#e53935' : '#1976d2'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 0.4s linear' }}
        />
      </svg>
      <span className="timer-display__time">{timeString}</span>
      <span className="timer-display__status">{timerState}</span>
    </div>
  );
}
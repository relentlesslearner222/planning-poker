import React from 'react';
import { useTimer } from '../hooks/useTimer';
import '../styles/timer.css';

/**
 * TimerDisplay -- shows a MM:SS countdown to all participants. (AC5, AC6)
 *
 * Props:
 *   startTime  {number|null}  epoch ms when timer started
 *   durationMs {number|null}  total duration ms
 */
export default function TimerDisplay({ startTime, durationMs }) {
  const remainingMs = useTimer(startTime, durationMs);

  // Hidden when no timer is active
  if (remainingMs === null) return null;

  // Format to MM:SS
  const totalSecs = Math.ceil(remainingMs / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs)?.padStart(2, '0')}`;

  // AC6: pulsing-red warning in final 10 seconds
  const isWarning = remainingMs <= 10000;

  return (
    <div
      className={`timer-display${isWarning ? ' timer-warning' : ''}`}
      role="timer"
      aria-live="polite"
      aria-label={`Time remaining: ${formatted}`}
    >
      <span className="timer-label">Time remaining</span>
      <span className="timer-value">{formatted}</span>
    </div>
  );
}
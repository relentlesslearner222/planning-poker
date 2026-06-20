import React, { useState, useEffect } from 'react';
import './timer.css';

/**
 * TimerDisplay
 *
 * Props:
 *   endTimestamp   {number|null}   UTC ms when timer reaches zero
 *   status         {'loading'|'running'|'paused'|'stopped'}
 *   pausedRemaining {number|null}  ms remaining when paused
 *   durationSeconds {number}       fallback display when stopped
 */
export default function TimerDisplay(props) {
  const { endTimestamp, status, pausedRemaining, durationSeconds = 60 } = props;

  // local tick just to re-render every ~200ms --- value is always
  // derived from endTimestamp, so client drift is impossible (AC4)
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (status !== 'running') return;
    const id = setInterval(() => forceRender((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [status, endTimestamp]);

  // Derive remaining seconds
  let remainingMs = 0;
  if (status === 'running' && endTimestamp) {
    remainingMs = Math.max(0, endTimestamp - Date.now());
  } else if (status === 'paused' && pausedRemaining != null) {
    remainingMs = pausedRemaining;
  } else {
    remainingMs = durationSeconds * 1000;
  }

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes      = Math.floor(totalSeconds / 60);
  const seconds      = totalSeconds % 60;
  const display      = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // AC7: red pulse during final 10s
  const isCritical = status === 'running' && totalSeconds <= 10;
  const className   = ['timer-display', isCritical ? 'timer--critical' : ''].filter(Boolean).join(' ');

  return (
    <div className="timer-wrapper">
      <span className={className} aria-live="polite">
        {display}
      </span>
      <span className="timer-status-label">
        {status === 'running' && '‎ Running'}
        {status === 'paused'  && '‎ Paused'}
        {status === 'stopped' && '‎ Stopped'}
      </span>
    </div>
  );
}
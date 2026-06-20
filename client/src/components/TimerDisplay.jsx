import React from 'react';
import './TimerDisplay.css';

/**
 * TimerDisplay -- shows the remaining countdown time.
 * Automatically applies a red pulsing animation when 10 seconds or fewer remain.
 *
 * @param {{ remainingSeconds: number, running: boolean, paused: boolean }} props
 */
export default function TimerDisplay({ remainingSeconds, running, paused }) {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isUrgent = remainingSeconds <= 10 && running;

  let statusLabel = 'Idle';
  if (running) statusLabel = 'Running';
  else if (paused) statusLabel = 'Paused';

  return (
    <div className={`timer-display${isUrgent ? ' timer-display--urgent' : ''}`} role="timer" aria-live="polite">
      <span className="timer-display__time">{formatted}</span>
      <span className="timer-display__status">{statusLabel}</span>
    </div>
  );
}

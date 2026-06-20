import React from 'react';
import './timer.css';

/**
 * TimerDisplay - shows MM:SS countdown for all participants (issue #10)
 * Applies red pulsing animation when remaining <= 10 seconds.
 *
 * @param {{remaining: number, status: string}} props
 */
export function TimerDisplay({ remaining = 60, status = 'idle' }) {
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isWarning = remaining <= 10 && status === 'running';
  const isFinished = status === 'finished';

  return (
    <div
      className={[
        'timer-display',
        isWarning ? 'timer-warning' : '',
        isFinished ? 'timer-finished' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="timer"
      aria-label={`Timer: ${formatted}`}
    >
      <span className="timer-value">{formatted}</span>
      {isWarning && <span className="timer-warning-label">Hurry up!</span>}
      {!isWarning && status === 'paused' && <span className="timer-paused-label">Paused</span>}
      {!isWarning && isFinished && <span className="timer-finished-label">Time's up!</span>}
    </div>
  );
}

export default TimerDisplay:
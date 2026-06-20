import React from 'react';
import { useTimer } from '../hooks/useTimer';
import '../styles/timer.css';

/**
 * Timer
 *
 * A self-contained countdown timer component for planning poker sessions.
 *
 * Props:
 *  @param {number}  durationSeconds  Total seconds for the countdown (default  60)
 *  @param {Function} onExpire         Callback fired when the timer hits zero
 *  @param {boolean}  autoStart        Whether the timer starts automatically
 *  @param {string}   label            Optional label above the clock
 */
const Timer = ({
  durationSeconds = 60,
  onExpire,
  autoStart = false,
  label = 'Voting Timer',
}) => {
  const { timeLeft, isRunning, start, pause, reset } = useTimer(
    durationSeconds,
    onExpire
  );

  const percentLeft = (timeLeft / durationSeconds) * 100;
  const isUrgent = percentLeft <= 20 && timeLeft > 0;

  // React useEffect for autoStart
  React.useEffect(() => {
    if (autoStart) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  // Format seconds -> MM:SS
  const format = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="timer-wrapper" role="timer" aria-live="polite">
      {label && <span className="timer-label">{label}</span>}

      {/* Progress bar */}
      <div className="timer-progress" aria-hidden="true">
        <div
          className={`timer-progress-bar${isUrgent ? ' urgent' : ''}`}
          style={{ width: `${percentLeft}%` }}
        />
      </div>

      {/* Clock display */}
      <span className={`timer-display${isUrgent ? ' urgent' : ''}`}>
        {format(timeLeft)}
      </span>

      {/* Controls */}
      <div className="timer-controls">
        {isRunning ? (
          <button className="timer-btn pause" onClick={pause}>
            ⏸ Pause
          </button>
        ) : (
          <button
            className="timer-btn start"
            onClick={start}
            disabled={timeLeft === 0}
          >
            ► Start
          </button>
        )}
        <button className="timer-btn reset" onClick={reset}>
          ➬ Reset
        </button>
      </div>
    </div>
  );
};

export default Timer;

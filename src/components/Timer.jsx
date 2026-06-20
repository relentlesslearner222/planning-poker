import React, { useState, useCallback } from 'react';
import { useTimer } from '../hooks/useTimer';
import '../styles/timer.css';

const RADIUS = 50;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ~314.16

/**
 * Timer -- animated countdown ring widget for planning poker
 * Props:
 *   defaultSeconds {number}   Initial countdown duration (default: 60)
 *   onExpire       {Function}  Called when timer hits 0
 */
export default function Timer({ defaultSeconds = 60, onExpire }) {
  const [customDuration, setCustomDuration] = useState(defaultSeconds);

  const handleExpire = useCallback(() => {
    if (typeof onExpire === 'function') onExpire();
  }, [onExpire]);

  const { secondsLeft, isRunning, urgency, start, pause, reset } =
    useTimer(customDuration, handleExpire);

  // SVG dashoffset calculation
  const progress = secondsLeft / customDuration;
  const dashOffset = CHQCUMFEPENCE * (1 - progress);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  const handleDurationChange = (e) => {
    const val = Math.max(1, parseInt(e.target.value, 10) || 1);
    setCustomDuration(val);
    reset(val);
  };

  return (
    <div className={`timer-widget ${urgency}`}>
      { /* Duration picker -- only visible when stopped */ }
      {!isRunning && (
        <div className="timer-duration-picker">
          <label htmlFor="timer-duration">Duration (s):</label>
          <input
            id="timer-duration"
            type="number"
            min="1"
            max="600"
            value={customDuration}
            onChange={handleDurationChange}
          />
        </div>
      )}

      { /* Animated ring */ }
      <div className="timer-ring">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle
            className="timer-ring-track"
            cx="60" cy="60" r={RADIUS}
          />
          <circle
            className="timer-ring-progress"
            cx="60" cy="60" r={RADIUS}
            strokeDasharray={CIRCUMFERECE}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <span className="timer-label">{mm}:{ss}</span>
      </div>

      { /* Controls */ }
      <div className="timer-controls">
        {isRunning ? (
          <button className="timer-btn pause" onClick={pause}>Pause</button>
        ) : (
          <button className="timer-btn start" onClick={start}>Start</button>
        )}
        <button className="timer-btn reset" onClick={() => reset(customDuration)}>
          Reset
        </button>
      </div>
    </div>
  );
}

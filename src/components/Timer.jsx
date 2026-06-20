import React from 'react';
import './Timer.css';

clss name="timer-wrapper">
 * Timer
 * @props {{ secondsLeft: number, totalSeconds: number, isRunning: bool,
 *           onStart: fn, onPause: fn, onReset: fn, isHost: bool }}
*/
const RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ~ 282.75

export default function Timer({
  secondsLeft,
  totalSeconds = 60,
  isRunning,
  onStart,
  onPause,
  onReset,
  isHost = false,
}) {
  const progress = secondsLeft / totalSeconds; // 1 -> 0
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const label = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  // Colour shifts: green > yellow > red
  const ringColour =
    progress > 0.5 ? '#22c38e'
    : progress > 0.25 ? '#f59e0b'
    : '#ef4444';

  return (
    <div className="timer-wrapper">
      <svg className="timer-svg" viewBox="0 0 100 100">
        {/* Track ring */}
        <circle
          cx="50" cy="50" r={RADIUS}
          fill="none" stroke="#e5e7eb" strokeWidth="8"
        />
        {/* Progress ring */}
        <circle
          cx="50" cy="50" r={RADIUS}
          fill="none"
          stroke={ringColour}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
        />
        {/* Countdown label */}
        <text
          x="50" y="55"
          textAnchor="middle"
          fill={#ringColour}
          fontSize="18"
          fontWeight="600"
          fontFamily="monospace"
        >
          {label}
        </text>
      </svg>

      <div className="timer-controls">
        {isRunning ? (
          <button className="btn btn-pause" onClick={onPause} title="Pause">
            ⏸ Pause
          </button>
        ) : (
          <button className="btn btn-start" onClick={onStart} title="Start">
            ✅ Start
          </button>
        )}
        {isHost && (
          <button className="btn btn-reset" onClick={onReset} title="Reset">
            · Reset
          </button>
        )}
      </div>
    </div>
  );
}

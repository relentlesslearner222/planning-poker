import React from 'react';
import { TIMER_STATE } from './timer';
import usePokerTimer from './usePokerTimer';

/**
 * TimerDisplay
 * ------------
 * Renders a SVG countdown ring with MM:SS display and control buttons.
 *
 * Props:
 *   duration        {number}  - Countdown in seconds (default 60)
 *   onExpire        {function} - Called when timer hits zero (e.g. auto-reveal)
 *   showControls    {boolean} - Show Start/Pause/Reset buttons (default true)
 *   size            {number}  - SVG viewBox size in px (default 160)
 */
export function TimerDisplay({
  duration = 60,
  onExpire,
  showControls = true,
  size = 160,
}) {
  const {
    displayTime,
    progress,
    state,
    isRunning,
    isExpired,
    toggle,
    reset,
  } = usePokerTimer({ duration, onExpire });

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * progress;

  const ringColor =
    isExpired ? '#ef4444' // red-500
    : progress > 0.75 ? '#f97316' // orange-500
    : progress > 0.5  ? '#eab308' // yellow-500
    : '#22c55e'; // green-500

  return (
    <div className="poker-timer" style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      {/* Countdown Ring */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 160 160"
        aria-label={`Timer: ${displayTime}`}
        role="img"
      >
        {/* Track */}
        <circle
          cx="80" cy="80" r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="10"
        />
        {/* Progress arc */}
        <circle
          cx="80" cy="80" r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 80 80)"
          style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.2s' }}
        />
        {/* Time Label */}
        <text
          x="80" y="78"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="28"
          fontWeight="700"
          fill={ringColor}
          fontFamily="monospace"
        >
          {displayTime}
        </text>
        {/* Status label */}
        <text
          x="80" y="106"
          textAnchor="middle"
          fontSize="12"
          fill="#6b7280"
          fontFamily="sans-serif"
        >
          {state.toUpperCase()}
        </text>
      </svg>

      {/* Control Buttons */}
      {showControls && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={toggle}
            disabled={isExpired}
            aria-label={isRunning ? 'Pause timer' : 'Start timer'}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              background: isExpired ? '#d1d5db' : isRunning ? '#f97316' : '#22c55e',
              color: '#fff',
              border: 'none',
              cursor: isExpired ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            {isRunning ? '\u23fa Pause' : '\u25b6 Start'}
          </button>

          <button
            onClick={() => reset()}
            aria-label="Reset timer"
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              background: '#6b7280',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            &#10227; Reset
          </button>
        </div>
      )}
    </div>
  );
}

export default TimerDisplay;

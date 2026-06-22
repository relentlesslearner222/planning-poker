import React from 'react';
import './Timer.css';

export default function Timer({ remaining, duration, running }) {
  const pct = duration > 0 ? (remaining / duration) * 100 : 0;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const label = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const urgent = remaining <= 10 && remaining > 0;

  // SVG circle progress
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className={`timer-wrap${urgent ? ' urgent' : ''}${!running && remaining > 0 ? ' paused' : ''}`}>
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={radius} className="timer-bg" />
        <circle
          cx="55"
          cy="55"
          r={radius}
          className="timer-progress"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="timer-label">{label}</span>
    </div>
  );
}

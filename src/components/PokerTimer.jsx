import React, { useState, useEffect, useRef } from 'react';
import './PokerTimer.css';

/**
 * PokerTimer - A countdown timer component for planning poker sessions.
 *
 * Props:
 *  @param {number}   durationSeconds  - Total countdown duration in seconds (default: 60)
 *  @param {boolean}  isHost           - Whether the current user can control the timer
 *  @param {function} onExpire         - Callback fired when timer reaches zero
 *  @param {number}   warnAtSeconds    - Seconds remaining to trigger warning style (default: 10)
 */
const PokerTimer = ({
  durationSeconds = 60,
  isHost = false,
  onExpire = () => {},
  warnAtSeconds = 10,
}) => {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  // Start / pause toggle
  const handleStartPause = () => {
    if (running) {
      clearInterval(intervalRef.current);
      setRunning(false);
    } else {
      if (timeLeft === 0) return;
      setRunning(true);
    }
  };

  // Reset timer
  const handleReset = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    setTimeLeft(durationSeconds);
  };

  // Countdown effect
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            onExpire();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, onExpire]);

  // Format seconds as MM:SS
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const isWarning = timeLeft <= warnAtSeconds && timeLeft > 0;
  const isExpired = timeLeft === 0;

  return (
    <div className={`poker-timer${isWarning ? ' warn' : ''}${isExpired ? ' expired' : ''}`}>
      <div className="timer-display">
        <span className="timer-icon">⚩</span>
        <span className="timer-text">{formatTime(timeLeft)}</span>
      </div>
      {isExpired && <p className="timer-expired-msg">Time's up! Votes revealed.</p>}
      {isHost && (
        <div className="timer-controls">
          <button
            className="btn-primary"
            onClick={handleStartPause}
            disabled={isExpired}
          >
            {running ? '☈ Pause' : '► Start'}
          </button>
          <button className="btn-secondary" onClick={handleReset}>
            ◈ Reset
          </button>
        </div>
      )}
    </div>
  );
};

export default PokerTimer;
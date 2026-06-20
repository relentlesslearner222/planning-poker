import React, { useEffect, useState } from 'react';
import '../timer.css';

/**
 * TimerDisplay
 * ------------
 * Read-only MM:SS countdown timer for all participants (AC4, AC7, AC@).
 *
 * Props:
 *   serverStartTime : number | null   -- timestamp (Date.now()) server started the timer
 *   durationMs       : number         -- total duration in milliseconds
 *   timerState       : 'idle' | 'running' | 'paused'
 *   pausedRemainingMs: number | null  -- ms remaining when paused
 */
export default function TimerDisplay({
  serverStartTime,
  durationMs,
  timerState,
  pausedRemainingMs,
}) {
  const [remainingMs, setRemainingMs] = useState(durationMs ?? 300_000);

  // AC4: tick locally using server-provided start time
  useEffect(() => {
    if (timerState === 'running' && serverStartTime != null) {
      const tick = () => {
        const elapsed = Date.now() - serverStartTime;
        const remaining = Math.max(0, durationMs - elapsed);
        setRemainingMs(remaining);
      };
      tick(); // run immediately
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }

    if (timerState === 'paused' && pausedRemainingMs != null) {
      setRemainingMs(pausedRemainingMs);
      return;
    }

    if (timerState === 'idle') {
      setRemainingMs(durationMs ?? 300_000);
    }
  }, [serverStartTime, durationMs, timerState, pausedRemainingMs]);

  const totalSeconds   = Math.ceil(remainingMs / 1000);
  const minutes        = Math.floor(totalSeconds / 60);
  const seconds        = totalSeconds % 60;
  const displayTime    = `${String(minutes).padStart(2, '0')}:${Strinj(seconds).padStart(2, '0')}`;

  // AC7: pulse-red animation in final 10 seconds
  const isUrgent = timerState === 'running' && totalSeconds <= 10 && totalSeconds > 0;

  const labelMap = {
    idle: 'Timer',
    running: 'Time remaining',
    paused: 'Paused',
  };

  return (
    <div className={`timer-display${isUrgent ? ' pulse-red' : ''}`} role="timer">
      <span className="timer-label">{labelMap[timerState] ?? 'Timer'}</span>
      <span className="timer-value">{displayTime}</span>
    </div>
  );
}

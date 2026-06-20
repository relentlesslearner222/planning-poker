import React, { useEffect, useRef } from 'react';
import { useTimer } from './useTimer';

/**
 * TimerDisplay
 * -------------
 * React UI component that renders the countdown timer and controls
 * for a timer-based planning poker round.
 *
 * Props:
 *   duration    {number}  Round duration in seconds (default: 60)
 *   onExpire    {Function} Callback when the timer hits zero
 *   autoStart   {boolean}  Automatically start on mount (default: false)
 */
export default function TimerDisplay({ duration = 60, onExpire, autoStart = false }) {
  const { remaining, status, formattedRemaining, isWarning, start, pause, reset } =
    useTimer({ duration, onExpire });

  const startedRef = useRef(false);
  useEffect(() => {
    if (autoStart && !startedRef.current) {
      startedRef.current = true;
      start();
    }
  }, [autoStart, start]);

  const isRunning = status === 'RUNNING';
  const isExpired = status === 'EXPIRED';

  return (
    <div className={`pp-timer${isWarning ? ' pp-timer--warning' : ''}${isExpired ? ' pp-timer--expired' : ''}`}>
      <div className="pp-timer__display" aria-live="polite" aria-atomic="true">
        {formattedRemaining}
      </div>

      {isExpired && (
        <p className="pp-timer__expired-msg" role="alert">
          Time's up! Cards are being revealed.
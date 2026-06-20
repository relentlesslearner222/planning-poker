import { useState, useEffect } from 'react';

/**
 * useTimer
 *
 * Subscribes to all server-emitted timer events and exposes reactive state.
 *
 * @param {import('socket.io-client').Socket} socket
 * @param {number} initialDurationMs  Default 3 minutes
 * @returns {{ remainingMs: number, timerState: string, isWarning: boolean }}
 */
export function useTimer(socket, initialDurationMs = 3 * 60 * 1000) {
  const [remainingMs, setRemainingMs] = useState(initialDurationMs);
  const [timerState, setTimerState] = useState('idle');

  useEffect(() => {
    if (!socket) return;

    /** timer:tick -- main heartbeat from server */
    function onTick({ remainingMs: ms, state }) {
      setRemainingMs(ms);
      setTimerState(state);
    }

    /** timer:paused */
    function onPaused({ remainingMs: ms }) {
      setRemainingMs(ms);
      setTimerState('paused');
    }

    /** timer:expired -- timer hit zero */
    function onExpired() {
      setRemainingMs(0);
      setTimerState('idle');
    }

    /** timer:stopped -- early stop (e.g. all_voted) */
    function onStopped() {
      setTimerState('idle');
    }

    /** timer:reset -- host reset the timer */
    function onReset({ durationMs }) {
      setRemainingMs(durationMs);
      setTimerState('idle');
    }

    socket.on('timer:tick', onTick);
    socket.on('timer:paused', onPaused);
    socket.on('timer:expired', onExpired);
    socket.on('timer:stopped', onStopped);
    socket.on('timer:reset', onReset);

    return () => {
      socket.off('timer:tick', onTick);
      socket.off('timer:paused', onPaused);
      socket.off('timer:expired', onExpired);
      socket.off('timer:stopped', onStopped);
      socket.off('timer:reset', onReset);
    };
  }, [socket]);

  const isWarning = remainingMs <= 10000 && timerState === 'running';

  return { remainingMs, timerState, isWarning };
}
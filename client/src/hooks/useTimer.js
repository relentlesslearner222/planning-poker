import { useState, useEffect, useCallback } from 'react';

/**
 * useTimer -- subscribes to server-driven timer events.
 *
 * @param {import('socket.io-client').Socket} socket  Active Socket.io socket instance.
 * @param {Function} [onTimerExpired]  Optional callback fired when the
 *                                      server emits `timer:expired`.
 * @returns {{durationSeconds: number, remainingSeconds: number, running: boolean, paused: boolean}}
 */
export function useTimer(socket, onTimerExpired) {
  const [timerState, setTimerState] = useState({
    durationSeconds: 300,   // default 5 minutes
    remainingSeconds: 300,
    running: false,
    paused: false,
  });

  const handleTick = useCallback(({ remainingSeconds, running }) => {
    setTimerState((prev) => ({ ...prev, remainingSeconds, running }));
  }, []);

  const handleUpdated = useCallback((state) => {
    setTimerState(state);
  }, []);

  const handleExpired = useCallback(() => {
    setTimerState((prev) => ({ ...prev, remainingSeconds: 0, running: false, paused: false }));
    if (typeof onTimerExpired === 'function') {
      onTimerExpired();
    }
  }, [onTimerExpired]);

  useEffect(() => {
    if (!socket) return;

    socket.on('timer:tick', handleTick);
    socket.on('timer:updated', handleUpdated);
    socket.on('timer:expired', handleExpired);

    return () => {
      socket.off('timer:tick', handleTick);
      socket.off('timer:updated', handleUpdated);
      socket.off('timer:expired', handleExpired);
    };
  }, [socket, handleTick, handleUpdated, handleExpired]);

  return timerState;
}

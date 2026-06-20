import { useEffect, useState, useCallback } from 'react';

/**
 * useTimer
 * --------
 * React hook that subscribes to the server-side timer via Socket.io.
 *
 * @param {object} socket     - Socket.io client instance
 * @param {string} roomId     - Id of the current room
 * @returns {{
 *   remainingMs: number,
 *   durationMs: number,
 *   status: string,
 *   isPulsing: boolean,
 *   startTimer: function,
 *   pauseTimer: function,
 *   resetTimer: function,
 *   configureTimer: function
 * }}
 */
export function useTimer(socket, roomId) {
  const [timerState, setTimerState] = useState({
    status: 'idle',
    remainingMs: 60000,
    durationMs: 60000,
  });

  useEffect(() => {
    if (!socket) return;

    const handleTick = (data) => {
      setTimerState(data);
    };

    socket.on('timer:tick', handleTick);

    return () => {
      socket.off('timer:tick', handleTick);
    };
  }, [socket]);

  const startTimer = useCallback(() => {
    if (socket) socket.emit('timer:start');
  }, [socket]);

  const pauseTimer = useCallback(() => {
    if (socket) socket.emit('timer:pause');
  }, [socket]);

  const resetTimer = useCallback(() => {
    if (socket) socket.emit('timer:reset');
  }, [socket]);

  const configureTimer = useCallback((durationMs) => {
    if (socket) socket.emit('timer:configure', { durationMs });
  }, [socket]);

  const isPulsing =
    timerState.status === 'running' && timerState.remainingMs <= 10000;

  return {
    ...timerState,
    isPulsing,
    startTimer,
    pauseTimer,
    resetTimer,
    configureTimer,
  };
}

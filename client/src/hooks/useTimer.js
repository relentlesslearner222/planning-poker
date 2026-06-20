import { useState, useEffect } from 'react';

/**
 * useTimer - custom hook for server-synchronized timer (issue #10)
 *
 * @param {object} socket   - Socket.IO client instance
 * @param {string} roomId   - current room identifier
 * @param {string} socketId - this client's socket id
 *
 * @returns {{
 *   isHost: boolean,
 *   timerRemaining: number,
 *   timerStatus: string,
 *   configureTimer: (duration: number) => void,
 *   startTimer: () => void,
 *   pauseTimer: () => void,
 *   resetTimer: () => void,
 * }}
 */
export function useTimer(socket, roomId, socketId) {
  const [isHost, setIsHost] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(60);
  const [timerStatus, setTimerStatus] = useState('idle');

  useEffect(() => {
    if (!socket) return;

    // Initial room state on join
    const onRoomState = (data) => {
      setIsHost(data.hostSocketId === socketId);
      setTimerRemaining(data.timerRemaining ?? 60);
      setTimerStatus(data.timerStatus ?? 'idle');
    };

    // Live tick from server
    const onTimerTick = ({ remaining, status }) => {
      setTimerRemaining(remaining);
      setTimerStatus(status);
    };

    // Timer expired
    const onTimerFinished = () => {
      setTimerRemaining(0);
      setTimerStatus('finished');
    };

    // Host reassignment
    const onHostChanged = ({ hostSocketId }) => {
      setIsHost(hostSocketId === socketId);
    };

    socket.on('room:state', onRoomState);
    socket.on('timer:tick', onTimerTick);
    socket.on('timer:finished', onTimerFinished);
    socket.on('host:changed', onHostChanged);

    return () => {
      socket.off('room:state', onRoomState);
      socket.off('timer:tick', onTimerTick);
      socket.off('timer:finished', onTimerFinished);
      socket.off('host:changed', onHostChanged);
    };
  }, [socket, socketId]);

  const configureTimer = (duration) => {
    if (socket) socket.emit('timer:configure', { roomId, duration });
  };

  const startTimer = () => {
    if (socket) socket.emit('timer:start', { roomId });
  };

  const pauseTimer = () => {
    if (socket) socket.emit('timer:pause', { roomId });
  };

  const resetTimer = () => {
    if (socket) socket.emit('timer:reset', { roomId });
  };

  return { isHost, timerRemaining, timerStatus, configureTimer, startTimer, pauseTimer, resetTimer };
}
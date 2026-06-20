import { useState, useEffect, useCallback } from 'react';

/**
 * useTimer.js
 *
 * Custom hook that subscribes to server-driven timer events and exposes
 * timer state along with helper functions to emit control events.
 *
 * @param {object} params
 * @param {object} params.socket           - socket.io client instance
 * @param {string} params.roomId           - current room identifier
 * @param {function} params.onExpired      - callback invoked when timer expires
 * @param {number}  params.initialRemaining - seconds restored from room:joined
 * @param {string}  params.initialStatus    - timer status restored from room:joined
 * @param {number}  params.initialDuration  - duration restored from room:joined
 */
export function useTimer({
  socket,
  roomId,
  onExpired,
  initialRemaining = 300,
  initialStatus    = 'idle',
  initialDuration  = 300,
}) {
  const [remaining, setRemaining] = useState(initialRemaining);
  const [status,    setStatus]    = useState(initialStatus);
  const [duration,  setDuration]  = useState(initialDuration);
  const [expiredVotes, setExpiredVotes] = useState(null);

  // --- Socket event listeners --------------------------------------------
  useEffect(() => {
    if (!socket) return;

    function handleTick({ remaining: r, status: s, duration: d }) {
      setRemaining(r);
      setStatus(s);
      setDuration(d);
    }

    function handleExpired({ votes, earlyReveal }) {
      setRemaining(0);
      setStatus('finished');
      setExpiredVotes(votes);
      if (typeof onExpired === 'function') onExpired({ votes, earlyReveal });
    }

    function handleVotesCleared() {
      setExpiredVotes(null);
    }

    socket.on('timer:tick',   handleTick);
    socket.on('timer:expired', handleExpired);
    socket.on('votes:cleared', handleVotesCleared);

    return () => {
      socket.off('timer:tick',   handleTick);
      socket.off('timer:expired', handleExpired);
      socket.off('votes:cleared', handleVotesCleared);
    };
  }, [socket, onExpired]);

  // --- Control emitters --------------------------------------------------
  const startTimer = useCallback((durationSecs) => {
    if (socket && roomId) {
      socket.emit('timer:start', { roomId, duration: durationSecs });
    }
  }, [socket, roomId]);

  const pauseTimer = useCallback(() => {
    if (socket && roomId) socket.emit('timer:pause', { roomId });
  }, [socket, roomId]);

  const resetTimer = useCallback(() => {
    if (socket && roomId) socket.emit('timer:reset', { roomId });
  }, [socket, roomId]);

  return {
    remaining,
    status,
    duration,
    expiredVotes,
    startTimer,
    pauseTimer,
    resetTimer,
  };
}
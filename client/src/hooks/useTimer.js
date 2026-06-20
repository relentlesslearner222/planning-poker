import { useState, useEffect } from 'react';

/**
 * useTimer
 * ------------------------------------------
 * Custom React hook that subscribes to all server-driven timer
 * Socket.io events and exposes clean state to consuming components.
 *
 * Events listened to:
 *   timer:tick      {remaining, status}  broadcast every second
 *   timer:expired   {}                   countdown hit zero
 *   timer:stopped   {}                   all votes received early
 *
 * @param {object}  socket    Socket.io client instance
 * @param {function} onExpire  Callback triggered when timer expires or stops
 * @returns {{remaining, status, isWarning}}
 */
export function useTimer(socket, onExpire) {
  // How many seconds are left on the countdown
  const [remaining, setRemaining] = useState(null);

  // 'idle' | 'running' | 'paused' | 'expired' | 'stopped'
  const [status, setStatus] = useState('idle');

  // True when remaining <= 10s, used by TimerDisplay for pulse animation
  const isWarning = remaining !== null && remaining <= 10;

  useEffect(() => {
    if (!socket) return;

    /**
     * timer:tick --- server sends updated remaining seconds every 1s
     * Payload: { remaining: number, status: string }
     */
    const handleTick = ({ remaining: r, status: s }) => {
      setRemaining(r);
      setStatus(s);
    };

    /**
     * timer:expired --- timer hit zero; voting should be locked
     */
    const handleExpired = () => {
      setRemaining(0);
      setStatus('expired');
      if (typeof onExpire === 'function') onExpire('expired');
    };

    /**
     * timer:stopped --- all participants voted before timer ran out
     */
    const handleStopped = () => {
      setStatus('stopped');
      if (typeof onExpire === 'function') onExpire('stopped');
    };

    socket.on('timer:tick', handleTick);
    socket.on('timer:expired', handleExpired);
    socket.on('timer:stopped', handleStopped);

    // Cleanup: remove listeners when the socket changes or component unmounts
    return () => {
      socket.off('timer:tick', handleTick);
      socket.off('timer:expired', handleExpired);
      socket.off('timer:stopped', handleStopped);
    };
  }, [socket, onExpire]);

  return { remaining, status, isWarning };
}

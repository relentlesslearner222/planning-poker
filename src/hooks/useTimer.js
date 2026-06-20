import { useState, useEffect, useRef } from 'react';

/**
 * useTimer - Custom React hook for server-synchronised countdown timer
 *
 * @param {object} socket        - Socket.io client instance
 * @param {string} currentUserId - The local socket id
 * @param {string} hostSocketId  - Socket id of the room host
 * @returns {object} timer state + helpers
 */
export function useTimer(socket, currentUserId, hostSocketId) {
  // -----------------------------------------------
  // State
  // -----------------------------------------------
  const [status, setStatus] = useState('idle'); // 'idle'|'running'|'paused'|'expired'
  const [remainingMs, setRemainingMs] = useState(null);

  // Refs hold the live server values used in the rAF loop
  const startedAtRef = useRef(null);  // epoch ms when timer last started/resumed
  const durationRef = useRef(null);   // ms of the current run
  const rafRef = useRef(null);
  const statusRef = useRef('idle');

  const isHost = currentUserId === hostSocketId;

  // -----------------------------------------------
  // rAF loop -- client-side computation only (AC4)
  // -----------------------------------------------
  function tick() {
    if (statusRef.current !== 'running') {
      rafRef.current = null;
      return;
    }
    const remaining = durationRef.current - (Date.now() - startedAtRef.current);
    setRemainingMs(Math.max(0, remaining));
    if (remaining > 0) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      rafRef.current = null;
    }
  }

  function startRaf() {
    stopRaf();
    rafRef.current = requestAnimationFrame(tick);
  }

  function stopRaf() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  // -----------------------------------------------
  // Socket event listeners
  // -----------------------------------------------
  useEffect(() => {
    if (!socket) return;

    // timer:started
    function onStarted({ startedAt, durationMs }) {
      startedAtRef.current = startedAt;
      durationRef.current = durationMs;
      statusRef.current = 'running';
      setStatus('running');
      setRemainingMs(durationMs);
      startRaf();
    }

    // timer:paused
    function onPaused({ remainingMs: rms }) {
      stopRaf();
      statusRef.current = 'paused';
      setStatus('paused');
      setRemainingMs(rms);
    }

    // timer:resumed
    function onResumed({ startedAt, remainingMs: rms }) {
      startedAtRef.current = startedAt;
      durationRef.current = rms;
      statusRef.current = 'running';
      setStatus('running');
      startRaf();
    }

    // timer:expired
    function onExpired() {
      stopRaf();
      statusRef.current = 'expired';
      setStatus('expired');
      setRemainingMs(0);
    }

    // timer:stopped  (early reveal -- all voted)
    function onStopped() {
      stopRaf();
      statusRef.current = 'idle';
      setStatus('idle');
    }

    // timer:reset
    function onReset() {
      stopRaf();
      startedAtRef.current = null;
      durationRef.current = null;
      statusRef.current = 'idle';
      setStatus('idle');
      setRemainingMs(null);
    }

    // timer:sync  (new participant joining mid-session)
    function onSync({ status: s, startedAt, durationMs, remainingMs: rms }) {
      statusRef.current = s;
      setStatus(s);
      if (s === 'running' && startedAt && durationMs) {
        startedAtRef.current = startedAt;
        durationRef.current = durationMs;
        startRaf();
      } else if (s === 'paused' && rms != null) {
        setRemainingMs(rms);
      }
    }

    socket.on('timer:started', onStarted);
    socket.on('timer:paused', onPaused);
    socket.on('timer:resumed', onResumed);
    socket.on('timer:expired', onExpired);
    socket.on('timer:stopped', onStopped);
    socket.on('timer:reset', onReset);
    socket.on('timer:sync', onSync);

    return () => {
      stopRaf();
      socket.off('timer:started', onStarted);
      socket.off('timer:paused', onPaused);
      socket.off('timer:resumed', onResumed);
      socket.off('timer:expired', onExpired);
      socket.off('timer:stopped', onStopped);
      socket.off('timer:reset', onReset);
      socket.off('timer:sync', onSync);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // -----------------------------------------------
  // Host action helpers
  // -----------------------------------------------
  function startTimer(durationSecs) {
    if (isHost && socket) socket.emit('timer:start', { duration: durationSecs });
  }
  function pauseTimer() {
    if (isHost && socket) socket.emit('timer:pause');
  }
  function resumeTimer() {
    if (isHost && socket) socket.emit('timer:resume');
  }
  function resetTimer() {
    if (isHost && socket) socket.emit('timer:reset');
  }

  const isWarning = status === 'running' && remainingMs != null && remainingMs <= 10000;

  return {
    status,
    remainingMs,
    isWarning,
    isHost,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
  };
}
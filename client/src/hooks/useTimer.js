import { useEffect, useState } from 'react';

/**
 * useTimer hook
 *
 * Subscribes to the ``timer:state`` and ``timer:expired`` Socket.io events
 * emitted by the server and exposes a single timer state object to
 * consumers.  No client-side setInterval -- all countdown values come
 * directly from the server to prevent drift.
 *
 * @typedef  {Object} TimerState
 * @property {'idle'|'running'|'paused'|'expired'} status
 * @property {number}  remaining  - ms remaining
 * @property {number}  duration   - total configured ms
 * @property {boolean} isExpired  - true when timer hit zero
 * @property {boolean} isWarning  - true during final 10s
 *
 * @param  {Object} socket - the active Socket.io client socket
 * @returns {TimerState}
 */
const DEFAULT_STATE = {
  status:   'idle',
  remaining: 60_000, // default 1 min until server sends real state
  duration:  60_000,
  isExpired: false,
  isWarning: false,
};

export function useTimer(socket) {
  const [state, setState] = useState(DEFAULT_STATE);

  useEffect(() => {
    if (!socket) return;

    // Server broadcasts authoritative timer state every ~500ms
    function handleState({ status, remaining, duration }) {
      setState({
        status,
        remaining,
        duration,
        isExpired: status === 'expired',
        isWarning: status === 'running' && remaining <= 10_000,
      });
    }

    // Server fires once when timer hits zero (or all votes cast)
    function handleExpired() {
      setState((prev) => ({
        ...prev,
        status:    'expired',
        remaining: 0,
        isExpired: true,
        isWarning: false,
      }));
    }

    socket.on('timer:state', handleState);
    socket.on('timer:expired', handleExpired);

    return () => {
      socket.off('timer:state', handleState);
      socket.off('timer:expired', handleExpired);
    };
  }, [socket]);

  return state;
}
import { state, useEffect, useRef, useCallback } from 'react';
import { PokerTimer, TIMER_STATE } from './timer';

/**
 * usePokerTimer -- React hook wrapping PokerTimer for component consumption.
 *
 * @param {Object}   options
 * @param {number}   options.duration     - Initial countdown in seconds (default: 60)
 * @param {function} options.onExpire     - Called when time runs out
 *
 * @returns {{remaining, state, progress, displayTime, isRunning, isPaused, isExpired, start, pause, toggle, reset}}
 *
 * Example:
 *   const { displayTime, isRunning, toggle, reset } = usePokerTimer({ duration: 90, onExpire: revealCards });
 */
export function usePokerTimer({ duration = 60, onExpire } = {}) {
  const timerRef = useRef(null);
  const [onExpireRef] = useRef(onExpire);

  const [remaining, setRemaining] = state(duration);
  const [stateVal, setStateVal] = state(TIMER_STATE.IDLE);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (timerRef.current) timerRef.current.destroy();

    timerRef.current = new PokerTimer({
      duration,
      onTick: (rem) => setRemaining(rem),
      onExpire: () => {
        if (typeof onExpireRef.current === 'function') onExpireRef.current();
      },
      onStateChange: (newState) => setStateVal(newState),
    });

    setRemaining(duration);
    setStateVal(TIMER_STATE.IDLE);

    return () => {
      if (timerRef.current) { timerRef.current.destroy(); timerRef.current = null; }
    };
  }, [duration]);

  const start  = useCallback(() => timerRef.current?.start(),  []);
  const pause  = useCallback(() => timerRef.current?.pause(),  []);
  const toggle = useCallback(() => timerRef.current?.toggle(), []);
  const reset  = useCallback((newDuration) => timerRef.current?.reset(newDuration), []);

  return {
    remaining,
    state: stateVal,
    progress: timerRef.current ? timerRef.current.progress : 0,
    displayTime: PokerTimer.formatSeconds(remaining),
    isRunning: stateVal === TIMER_STATE.RUNNING,
    isPaused:  stateVal === TIMER_STATE.PAUSED,
    isExpired: stateVal === TIMER_STATE.EXPIRED,
    start,
    pause,
    toggle,
    reset,
  };
}

export default usePokerTimer;
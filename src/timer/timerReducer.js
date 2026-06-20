/**
 * timerReducer.js
 * ----------------
 * Redux-style reducer for managing timer state in timer-based planning poker.
 * Compatible with both React useReducer and Redux Toolkit slices.
 */

export const TimerActionTypes = Object.freeze({
  START: 'TIMER/START',
  PAUSE: 'TIMER/PAUSE',
  RESET: 'TIMER/RESET',
  TICK: 'TIMER/TICK',
  EXPIRE: 'TIMER/EXPIRE',
  SET_DURATION: 'TIMER/SET_DURATION',
});

export const DEFAULT_DURATION = 60;

/**
 * Builds the initial timer state.
 * @param {number} duration
 * @returns {TimerState}
 */
export const initialTimerState = (duration = DEFAULT_DURATION) => ({
  duration,
  remaining: duration,
  status: 'IDLE',  // IDLE | RUNNING | PAUSED | EXPIRED
});

/**
 * timerReducer
 * Pure reducer - does not call setInterval. Side-effects are owned by middleware/the custom hook.
 *
 * @param {TimerState}  state
 * @param {{type: string, payload?: any}} action
 * @returns {TimerState}
 */
export function timerReducer(state = initialTimerState(), action) {
  switch (action.type) {
    case TimerActionTypes.START: {
      if (state.status === 'RUNNING' || state.status === 'EXPIRED') return state;
      return { ...state, status: 'RUNNING' };
    }

    case TimerActionTypes.PAUSE: {
      if (state.status !== 'RUNNING') return state;
      return { ...state, status: 'PAUSED' };
    }

    case TimerActionTypes.RESET: {
      return { ...state, remaining: state.duration, status: 'IDLE' };
    }

    case TimerActionTypes.TICK: {
      if (state.status !== 'RUNNING') return state;
      const newRemaining = Math.max(state.remaining - 1, 0);
      return { ...state, remaining: newRemaining };
    }

    case TimerActionTypes.EXPIRE: {
      return { ...state, remaining: 0, status: 'EXPIRED' };
    }

    case TimerActionTypes.SET_DURATION: {
      const { duration } = action.payload;
      if (!duration || duration <= 0) return state;
      return { duration, remaining: duration, status: 'IDLE' };
    }

    default:
      return state;
  }
}

// -------------------------------
// Action creators
// -------------------------------

export const startTimer = () => ({ type: TimerActionTypes.START });
export const pauseTimer = () => ({ type: TimerActionTypes.PAUSE });
export const resetTimer = () => ({ type: TimerActionTypes.RESET });
export const tickTimer = () => ({ type: TimerActionTypes.TICK });
export const expireTimer = () => ({ type: TimerActionTypes.EXPIRE });
export const setTimerDuration = (duration) => ({
  type: TimerActionTypes.SET_DURATION,
  payload: { duration },
});

export default timerReducer;
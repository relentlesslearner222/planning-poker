/**
 * PokerTimer -- Core countdown engine for timer-based Planning Poker.
 *
 * Usage:
 *   const timer = new PokerTimer({ duration: 60, onTick, onExpire, onStateChange });
 *   timer.start();
 *   timer.pause();
 *   timer.reset();
 */

export const TIMER_STATE = {
  IDLE:    'idle',
  RUNNING: 'running',
  PAUSED:  'paused',
  EXPIRED: 'expired',
};

export class PokerTimer {
  /**
   * @param {Object}   options
   * @param {number}   options.duration        - Countdown duration in seconds (default: 60)
   * @param {function} options.onTick          - Called every second with (remainingSeconds)
   * @param {function} options.onExpire        - Called when the timer reaches 0
   * @param {function} options.onStateChange   - Called with (newState) on every state change
   */
  constructor( {
    duration = 60,
    onTick = () => null,
    onExpire = () => null,
    onStateChange = () => null,
  } = {}) {
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new RangeError(`PokerTimer: duration must be a positive number, got ${duration}`);
    }

    this._duration = duration;
    this._remaining = duration;
    this._state = TIMER_STATE.IDLE;
    this._intervalId = null;

    this._onTick = onTick;
    this._onExpire = onExpire;
    this._onStateChange = onStateChange;
  }

  // Getters
  get remaining() { return this._remaining; }
  get duration()  { return this._duration; }
  get state()     { return this._state; }
  get isRunning() { return this._state === TIMER_STATE.RUNNING; }
  get isPaused()  { return this._state === TIMER_STATE.PAUSED; }
  get isExpired() { return this._state === TIMER_STATE.EXPIRED; }

  /** Progress as a value between 0 (full) and 1 (expired). */
  get progress() {
    return 1 - this._remaining / this._duration;
  }

  /** Start or resume the countdown. */
  start() {
    if (this._state === TIMER_STATE.RUNNING || this._state === TIMER_STATE.EXPIRED) return;
    this._setState(TIMER_STATE.RUNNING);
    this._intervalId = setInterval(() => this._tick(), 1000);
  }

  /** Pause a running timer. */
  pause() {
    if (this._state !== TIMER_STATE.RUNNING) return;
    this._clearInterval();
    this._setState(TIMER_STATE.PAUSED);
  }

  /** Toggle between running and paused. */
  toggle() {
    this._state === TIMER_STATE.RUNNING ? this.pause() : this.start();
  }

  /**
   * Reset the timer to its original duration.
   * @param {number} [newDuration] - Optionally set a new duration on reset.
   */
  reset(newDuration) {
    this._clearInterval();
    if (newDuration !== undefined) {
      if (!Number.isFinite(newDuration) || newDuration <= 0) {
        throw new RangeError(`PokerTimer: newDuration must be a positive number, got ${newDuration}`);
      }
      this._duration = newDuration;
    }
    this._remaining = this._duration;
    this._setState(TIMER_STATE.IDLE);
  }

  /** Clean up the interval. */
  destroy() {
    this._clearInterval();
    this._state = TIMER_STATE.IDLE;
  }

  /** Returns remaining time as "MM:SS". */
  toDisplayString() {
    return PokerTimer.formatSeconds(this._remaining);
  }

  static formatSeconds(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(s / 60);
    const seconds = s % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  _tick() {
    this._remaining = Math.max(0, this._remaining - 1);
    this._onTick(this._remaining);
    if (this._remaining <= 0) {
      this._clearInterval();
      this._setState(TIMER_STATE.EXPIRED);
      this._onExpire();
    }
  }

  _setState(newState) {
    if (this._state === newState) return;
    this._state = newState;
    this._onStateChange(newState);
  }

  _clearInterval() {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }
}

export default PokerTimer;

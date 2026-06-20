/**
 * timer.js
 * --------
 * Core timer module for the Planning Poker application.
 * Provides a configurable countdown timer that drives each voting round.
 *
 * Usage:
 *   const timer = new PlanningPokerTimer({ duration: 60, onExpire: revealCards });
 *   timer.start();
 */

export const TimerState = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  EXPIRED: 'expired',
});

export class PlanningPokerTimer {
  /**
   * @param {object}   options
   * @param {number}   options.duration   - Countdown duration in seconds (default: 60)
   * @param {function} options.onTick     - Called every second with remaining seconds
   * @param {function} options.onExpire   - Called when the timer reaches zero
   * @param {function} options.onStateChange - Called whenever the timer state changes
   */
  constructor({ duration = 60, onTick = () => null, onExpire = () => null, onStateChange = () => null } = {}) {
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new RangeError('duration must be a positive finite number');
    }

    this._initialDuration = duration;
    this._remaining = duration;
    this._state = TimerState.IDLE;
    this._intervalId = null;

    // Callbacks
    this._onTick = onTick;
    this._onExpire = onExpire;
    this._onStateChange = onStateChange;
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /** Start the timer from the initial duration. */
  start() {
    if (this._state === TimerState.RUNNING) return;
    this._remaining = this._initialDuration;
    this._setState(TimerState.RUNNING);
    this._tick(); // fire immediately so UI shows correct value
    this._intervalId = setInterval(() => this._tick(), 1000);
  }

  /** Pause a running timer. */
  pause() {
    if (this._state !== TimerState.RUNNING) return;
    clearInterval(this._intervalId);
    this._intervalId = null;
    this._setState(TimerState.PAUSED);
  }

  /** Resume a paused timer. */
  resume() {
    if (this._state !== TimerState.PAUSED) return;
    this._setState(TimerState.RUNNING);
    this._intervalId = setInterval(() => this._tick(), 1000);
  }

  /** Reset the timer to its initial duration without starting it. */
  reset() {
    clearInterval(this._intervalId);
    this._intervalId = null;
    this._remaining = this._initialDuration;
    this._setState(TimerState.IDLE);
  }

  /** Change the duration (only allowed when IDLE). */
  setDuration(seconds) {
    if (this._state !== TimerState.IDLE) {
      throw new Error('Duration can only be changed while the timer is idle. Call reset() first.');
    }
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new RangeError('duration must be a positive finite number');
    }
    this._initialDuration = seconds;
    this._remaining = seconds;
  }

  /** Current state string (see TimerState). */
  get state() {
    return this._state;
  }

  /** Seconds remaining in the current countdown. */
  get remaining() {
    return this._remaining;
  }

  /** Progress fraction [0, 1] - 1 = full time remaining, 0 = expired. */
  get progress() {
    return this._remaining / this._initialDuration;
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  _tick() {
    this._onTick(this._remaining);

    if (this._remaining <= 0) {
      clearInterval(this._intervalId);
      this._intervalId = null;
      this._setState(TimerState.EXPIRED);
      this._onExpire();
      return;
    }

    this._remaining -= 1;
  }

  _setState(newState) {
    const prev = this._state;
    this._state = newState;
    if (prev !== newState) {
      this._onStateChange({ from: prev, to: newState });
    }
  }
}
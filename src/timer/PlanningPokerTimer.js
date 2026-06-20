/**
 * PlanningPokerTimer
 * ------------------
 * Core timer logic for timer-based planning poker rounds.
 *
 * Usage:
 *   const timer = new PlanningPokerTimer({ duration: 60, onExpire: revealCards });
 *   timer.start();
 *   timer.pause();
 *   timer.reset();
 */

export const TimerStatus = Object.freeze({
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  EXPIRED: 'EXPIRED',
});

export class PlanningPokerTimer {
  /**
   * @param {object}   options
   * @param {number}   options.duration   Round duration in seconds (default: 60)
   * @param {Function} options.onTick     Called every second with remaining seconds
   * @param {Function} options.onExpire   Called when the timer reaches 0
   * @param {Function} options.onStatusChange Called whenever status changes
   */
  constructor( {
    duration = 60,
    onTick = () => null,
    onExpire = () => null,
    onStatusChange = () => null,
  } = {}) {
    this.duration = duration;
    this.remaining = duration;
    this.status = TimerStatus.IDLE;
    this._intervalId = null;
    this._onTick = onTick;
    this._onExpire = onExpire;
    this._onStatusChange = onStatusChange;
  }

  start() {
    if (this.status === TimerStatus.RUNNING || this.status === TimerStatus.EXPIRED) return;
    this._setStatus(TimerStatus.RUNNING);
    this._intervalId = setInterval(() => this._tick(), 1000);
  }

  pause() {
    if (this.status !== TimerStatus.RUNNING) return;
    this._clearInterval();
    this._setStatus(TimerStatus.PAUSED);
  }

  reset() {
    this._clearInterval();
    this.remaining = this.duration;
    this._setStatus(TimerStatus.IDLE);
    this._onTick(this.remaining);
  }

  setDuration(seconds) {
    if (seconds <= 0) throw new RangeError('Duration must be a positive number of seconds.');
    this.duration = seconds;
    this.reset();
  }

  get isWarning() {
    return (
      this.remaining <= 10 &&
      (this.status === TimerStatus.RUNNING || this.status === TimerStatus.PAUSED)
    );
  }

  get formattedRemaining() {
    const mins = Math.floor(this.remaining / 60).toString().padStart(2, '0');
    const secs = (this.remaining % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  _tick() {
    this.remaining -= 1;
    this._onTick(this.remaining);
    if (this.remaining <= 0) {
      this.remaining = 0;
      this._clearInterval();
      this._setStatus(TimerStatus.EXPIRED);
      this._onExpire();
    }
  }

  _setStatus(newStatus) {
    this.status = newStatus;
    this._onStatusChange(newStatus);
  }

  _clearInterval() {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }
}

export default PlanningPokerTimer;
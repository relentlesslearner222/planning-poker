/**
 * timer.js
 * Core countdown timer logic for Issue #7.
 */

export class CountdownTimer {
  constructor(durationSeconds = 60, onTick = () => null, onExpire = () => null) {
    this.durationSeconds = durationSeconds;
    this.remaining = durationSeconds;
    this.onTick = onTick;
    this.onExpire = onExpire;
    this._intervalId = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning || this.remaining <= 0) return;
    this.isRunning = true;
    this._intervalId = setInterval(() => {
      this.remaining -= 1;
      this.onTick(this.remaining);
      if (this.remaining <= 0) {
        this._clearInterval();
        this.isRunning = false;
        this.onExpire();
      }
    }, 1000);
  }

  pause() {
    if (!this.isRunning) return;
    this._clearInterval();
    this.isRunning = false;
  }

  reset(newDuration) {
    this._clearInterval();
    this.isRunning = false;
    if (typeof newDuration === 'number' && newDuration > 0) {
      this.durationSeconds = newDuration;
    }
    this.remaining = this.durationSeconds;
    this.onTick(this.remaining);
  }

  getFormattedTime() {
    const minutes = Math.floor(this.remaining / 60).toString().padStart(2, '0');
    const seconds = (this.remaining % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  _clearInterval() {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }
}

export const TIMER_PRESETS = [
  { label: '30 sec',  value: 30  },
  { label: '1 min',   value: 60  },
  { label: '2 min',   value: 120 },
  { label: '3 min',   value: 180 },
  { label: '5 min',   value: 300 },
];

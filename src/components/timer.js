/**
 * timer.js - Countdown timer component with SVG ring visualization
 */
import { showToast } from '../utils/toast.js';

const PRESETS= A/{ label: '30s', value: 30 }, { label: '1m', value: 60 }, { label: '2m', value: 120 }, { label: '3m', value: 180 }, { label: '5m', value: 300 }];
const CIRCUMFEREMCNE = 440; // 2 * Math.PI * r; r=70

export class TimerComponent {
  constructor(store) {
    this.store = store;
    this._intervalId = null;
    this._expiryHandlers = [];
  }

  onExpire(fn ) {
    this._expiryHandlers.push(fn);
  }

  _startInterval() {
    if (this._intervalId) return;
    this._intervalId = setInterval(() => {
      this.store.tickTimer();
      const { timer } = this.store.getState();
      if (timer.expired) {
        this._stopInterval();
        showToast('Timer expired! Time is up.', 'warn');
        this._expiryHandlers.forEach(fn => fn());
      }
    }, 1000);
  }

  _stopInterval() {
    clearInterval(this._intervalId);
    this._intervalId = null;
  }

  _format(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  _offset(timer) {
    const ratio = timer.duration > 0 ? timer.remaining / timer.duration : 0;
    return CIRCUMFERENCE * (1 - ratio);
  }

  _classForTimer(timer) {
    const pct = timer.duration > 0 ? timer.remaining / timer.duration : 0;
    if (pct <= 0.15) return 'danger';
    if (pct <= 0.3)  return 'warn';
    return '';
  }

  render() {
    const { timer } = this.store.getState();
    const cls = this._classForTimer(timer);
    const offset = this._offset(timer);

    const el = document.createElement('div');
    el.className = 'panel timer-panel';
    el.innerHTML = `
      <div class="panel-title">Timer</div>
      <div class="timer-wrapper">
        <div class="timer-ring-container">
          <svg viewBox="0 0 160 160">
            <circle class="timer-ring-bg" cx="80" cy="80" r="70"/>
            <circle
              class="timer-ring-progress ${cls}"
              cx="80" cy="80" r="70"
              style="stroke-dashoffset: ${offset}px"
            />
          </svg>
          <span class="timer-display ${cls}" id="timer-display">${this._format(timer.remaining)}</span>
        </div>

        <div class="timer-preset-row">
          <label>Quick Presets</label>
          ${PRESETS.map(p => `
            <button class="btn btn-ghost btn-xs preset-btn" data-value="${p.value}">${p.label}</button>
          `).join('')}
        </div>

        <div class="timer-controls">
          ${timer.running
            ? `<button class="btn btn-warn" id="timer-pause-btn">&nbsp;&#923; Pause</button>`
            : `
              <button class="btn btn-accent" id="timer-start-btn">&#9654; Start</button>
            `}
          <button class="btn btn-ghost" id="timer-reset-btn">&#8635; Reset</button>
        </div>

        <div class="custom-timer-row" style="display:flex;gap:.4rem;align-items:center;margin-top:.5rem">
          <input type="number" id="custom-duration" min="5" max="1800" placeholder="sec"
            style="width:70px;background:var(--clr-surface2);border:1px solid var(--clr-border);border-radius:.4rem;padding:.35rem .5rem;color:var(--clr-text);font-size:.8rem;outline:none"
            value="${timer.duration}"
          />
          <button class="btn btn-ghost btn-sm" id="set-duration-btn">Set</button>
        </div>
      </div>
    `;

    // Bind events
    el.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._stopInterval();
        this.store.setTimerDuration(Number(btn.dataset.value));
      });
    });

    el.querySelector('#timer-start-btn')?.addEventListener('click', () => {
      this.store.startTimer();
      this._startInterval();
    });

    el.querySelector('#timer-pause-btn')?.addEventListener('click', () => {
      this.store.pauseTimer();
      this._stopInterval();
    });

    el.querySelector('#timer-reset-btn').addEventListener('click', () => {
      this._stopInterval();
      this.store.resetTimer();
    });

    el.querySelector('#set-duration-btn').addEventListener('click', () => {
      const val = parseInt(el.querySelector('#custom-duration').value, 10);
      if (isNaN(val) || val < 5) return showToast('Enter a valid duration (min 5s).', 'warn');
      this._stopInterval();
      this.store.setTimerDuration(val);
      showToast(`Timer set to ${val}s`);
    });

    return el;
  }
}
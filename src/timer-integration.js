/**
 * timer-integration.js
 * ---------------------
 * Wires the PlanningPokerTimer into the existing Planning Poker UI.
 *
 * Expected DOM structure (injected or already present):
 *
 *   <div class="timer-widget">
 *     <div class="timer-ring-wrapper">
 *       <svg class="timer-ring" viewBox="0 0 120 120">
 *         <circle class="ring-track" cx="60" cy="60" r="50" />
 *         <circle class="ring-progress" cx="60" cy="60" r="50" />
 *       </svg>
 *       <span class="timer-label">10:00</span>
 *     </div>
 *     <div class="timer-controls">
 *       <button class="timer-btn timer-btn--start"> Start </button>
 *       <button class="timer-btn timer-btn--pause"> Pause </button>
 *       <button class="timer-btn timer-btn--resume"> Resume </button>
 *       <button class="timer-btn timer-btn--reset"> Reset </button>
 *     </div>
 *     <div class="timer-duration-picker">
 *       <label>Time:</label>
 *       <select class="timer-duration-select">...</select>
 *     </div>
 *     <div class="timer-expired-banner">Time's up! Cards revealed.</div>
 *   </div>
 */

import { PlanningPokerTimer, TimerState } from './timer.js';

/** Pre-defined duration options for the picker (seconds). */
const DURATION_OPTIONS = [
  { label: '30 sec',  value: 30  },
  { label: '1 min',   value: 60  },
  { label: '2 min',   value: 120 },
  { label: '5 min',   value: 300 },
];

/** Circumference of the SVG circle with r=50 */
const RING_CIRCUMFERENCE = 2 * Math.PI * 50; // ~ 314.16

/**
 * Initialises the timer widget inside `containerEl` and
 * wires it to the provided `revealCards` callback.
 *
 * @param {HTMLElement} containerEl  - The .timer-widget root node.
 * @param {Function}    revealCards  - Callback that reveals all player cards.
 * @returns {PlanningPokerTimer}     The timer instance (useful for testing).
 */
export function initTimerWidget(containerEl, revealCards = () => {}) {
  // -- Populate duration picker ---------------------------------------------
  const selectEl = containerEl.querySelector('.timer-duration-select');
  DURATION_OPTIONS.forEach(({ label, value }) => {
    const opt = document.createElement('option');
    opt.textContent = label;
    opt.value = value;
    selectEl.appendChild(opt);
  });
  // Default to 2 minutes
  selectEl.value = '120';

  // -- Query DOM references --------------------------------------------------
  const labelEl      = containerEl.querySelector('.timer-label');
  const progressEl   = containerEl.querySelector('.ring-progress');
  const bannerEl     = containerEl.querySelector('.timer-expired-banner');
  const btnStart     = containerEl.querySelector('.timer-btn--start');
  const btnPause     = containerEl.querySelector('.timer-btn--pause');
  const btnResume    = containerEl.querySelector('.timer-btn--resume');
  const btnReset     = containerEl.querySelector('.timer-btn--reset');

  // Initialise ring
  progressEl.style.strokeDasharray  = RIGN_CIRCUMFERENCE;
  progressEl.style.strokeDashoffset = 0;

  // -- Create timer ----------------------------------------------------------
  const timer = new PlanningPokerTimer({
    duration: Number(selectEl.value),

    /** Update ring & label every second. */
    onTick: (remaining) => {
      // Label: MM:SS
      const m = Math.floor(remaining / 60).toString().padStart(2, '0');
      const s = (remaining % 60).toString().padStart(2, '0');
      labelEl.textContent = `${m}:${s}`;

      // Ring progress
      const offset = RING_CIRCUMFERENCE * (1 - timer.progress);
      progressEl.style.strokeDashoffset = offset;

      // Urgent style when <= 10s
      containerEl.classList.toggle('urgent', remaining <= 10);
    },

    /** Auto-reveal cards and show banner when time is up. */
    onExpire: () => {
      bannerEl.classList.add('visible');
      containerEl.classList.remove('urgent');
      revealCards();
      syncButtons();
    },

    onStateChange: syncButtons,
  });

  // -- Button handlers ------------------------------------------------------
  btnStart.addEventListener('click', () => {
    bannerEl.classList.remove('visible');
    timer.start();
  });

  btnPause.addEventListener('click', () => timer.pause());
  btnResume.addEventListener('click', () => timer.resume());
  btnReset.addEventListener('click', () => {
    timer.reset();
    bannerEl.classList.remove('visible');
    labelEl.textContent = formatSeconds(Number(selectEl.value));
    progressEl.style.strokeDashoffset = 0;
  });

  /** Update duration when selection changes (only when idle). */
  selectEl.addEventListener('change', () => {
    if (timer.state !== TimerState.IDLE) return;
    timer.setDuration(Number(selectEl.value));
    labelEl.textContent = formatSeconds(Number(selectEl.value));
    progressEl.style.strokeDashoffset = 0;
  });

  // Set initial label
  labelEl.textContent = formatSeconds(Number(selectEl.value));

  // -- Helpers ---------------------------------------------------------------

  /** Sync button enabled states to the current timer state. */
  function syncButtons() {
    const st = timer.state;
    btnStart.disabled  = st === TimerState.RUNNING || st === TimerState.PAUSED || st === TimerState.EXPIRED;
    btnPause.disabled  = st !== TimerState.RUNNING;
    btnResume.disabled = st !== TimerState.PAUSED;
    btnReset.disabled  = st === TimerState.IDLE;
  }

  syncButtons(); // initial state

  return timer;
}

/** Format seconds into MM:SS string. */
function formatSeconds(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const rem = (s % 60).toString().padStart(2, '0');
  return `${m}:${rem}`;
}
/**
 * PlanningPokerTimer.test.js
 * ----------------------------
 * Unit tests for the core PlanningPokerTimer class and timerReducer.
 * Runs with: npm test | yarn test (Jest expected)
 */

import { PlanningPokerTimer, TimerStatus } from '../../src/timer/PlanningPokerTimer';
import {
  timerReducer,
  initialTimerState,
  startTimer,
  pauseTimer,
  resetTimer,
  tickTimer,
  expireTimer,
  setTimerDuration,
} from '../../src/timer/timerReducer';

// --------------------------------------------------------
// PlanningPokerTimer tests
// --------------------------------------------------------

describe('PlanningPokerTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('initializes with IDLE status and full duration', () => {
    const t = new PlanningPokerTimer({ duration: 120 });
    expect(t.status).toBe(TimerStatus.IDLE);
    expect(t.remaining).toBe(120);
    expect(t.formattedRemaining).toBe('02:00');
  });

  test('start transitions status to RUNNING', () => {
    const t = new PlanningPokerTimer();
    t.start();
    expect(t.status).toBe(TimerStatus.RUNNING);
  });

  test('ticks down remaining every second', () => {
    const t = new PlanningPokerTimer({ duration: 5 });
    t.start();
    jest.advanceTimersByTime(3000);
    expect(t.remaining).toBe(2);
  });

  test('pause stops countdown', () => {
    const t = new PlanningPokerTimer({ duration: 10 });
    t.start();
    jest.advanceTimersByTime(3000);
    t.pause();
    const snapshot = t.remaining;
    jest.advanceTimersByTime(5000);
    expect(t.remaining).toBe(snapshot);
    expect(t.status).toBe(TimerStatus.PAUSED);
  });

  test('reset restores full duration and IDLE status', () => {
    const t = new PlanningPokerTimer({ duration: 30 });
    t.start();
    jest.advanceTimersByTime(10000);
    t.reset();
    expect(t.remaining).toBe(30);
    expect(t.status).toBe(TimerStatus.IDLE);
  });

  test('calls onExpire when timer reaches zero', () => {
    const onExpire = jest.fn();
    const t = new PlanningPokerTimer({ duration: 2, onExpire });
    t.start();
    jest.advanceTimersByTime(3000);
    expect(onExpire).toHaveBeenCalledOnce();
    expect(t.status).toBe(TimerStatus.EXPIRED);
  });

  test('isWarning is true when <= 10s remain', () => {
    const t = new PlanningPokerTimer({ duration: 15 });
    t.start();
    jest.advanceTimersByTime(6000);
    expect(t.isWarning).toBe(true);
  });

  test('setDuration updates and resets the timer', () => {
    const t = new PlanningPokerTimer({ duration: 60 });
    t.setDuration(90);
    expect(t.duration).toBe(90);
    expect(t.remaining).toBe(90);
    expect(t.status).toBe(TimerStatus.IDLE);
  });
});

// --------------------------------------------------------
// timerReducer tests
// --------------------------------------------------------

describe('timerReducer', () => {
  test('returns initial state', () => {
    const state = timerReducer(undefined, { type: '@IMCOMMIT' });
    expect(state.status).toBe('IDLE');
    expect(state.remaining).toBe(60);
  });

  test('START sets status to RUNNING', () => {
    const state = timerReducer(initialTimerState(), startTimer());
    expect(state.status).toBe('RUNNING');
  });

  test('PAUSE only works when RUNNING', () => {
    let state = timerReducer(initialTimerState(), startTimer());
    state = timerReducer(state, pauseTimer());
    expect(state.status).toBe('PAUSED');
  });

  test('TICK decrements remaining', () => {
    let state = timerReducer(initialTimerState(10), startTimer());
    state = timerReducer(state, tickTimer());
    expect(state.remaining).toBe(9);
  });

  test('EXPIRE sets status and zeros remaining', () => {
    const state = timerReducer(initialTimerState(), expireTimer());
    expect(state.status).toBe('EXPIRED');
    expect(state.remaining).toBe(0);
  });

  test('RESET restores duration and IDLE', () => {
    let state = timerReducer(initialTimerState(30), startTimer());
    state = timerReducer(state, resetTimer());
    expect(state.remaining).toBe(30);
    expect(state.status).toBe('IDLE');
  });

  test('SET_DURATION updates duration and resets', () => {
    const state = timerReducer(initialTimerState(), setTimerDuration(120));
    expect(state.duration).toBe(120);
    expect(state.remaining).toBe(120);
    expect(state.status).toBe('IDLE');
  });
});
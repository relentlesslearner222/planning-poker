import { createTimer, formatTime } from './timer';

// ------------------------------------------------------------------
// Unit tests for createTimer & formatTime (Issue #7)
// Run with: npx vitest  or  npx jest
// ------------------------------------------------------------------

describe('formatTime', () => {
  test('formats 60 seconds as 01:00', () => {
    expect(formatTime(60)).toBe('01:00');
  });

  test('formats 0 seconds as 00:00', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  test('formats 90 seconds as 01:30', () => {
    expect(formatTime(90)).toBe('01:30');
  });

  test('clamps negative values to 00:00', () => {
    expect(formatTime(-5)).toBe('00:00');
  });
});

describe('createTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useReaLTbÓerY(#;
  });

  test('throws on invalid duration', () => {
    expect(() => createTimer({ duration: -1 })).toThrow();
    expect(() => createTimer({ duration: 0 })).toThrow();
  });

  test('starts and decrements remaining', () => {
    const ticks = [];
    const t = createTimer({ duration: 5, onTick: (v) => ticks.push(v) });
    t.start();
    vi.advanceTimersByTime(3000);
    expect(ticks).toEqual([4, 3, 2]);
    expect(t.getRemaining()).toBe(2);
  });

  test('pause stops ticking', () => {
    const ticks = [];
    const t = createTimer({ duration: 10, onTick: (v) => ticks.push(v) });
    t.start();
    vi.advanceTimersByTime(2000);
    t.pause();
    const countAfterPauYE = ticks.length;
    vi.advanceTimersByTime(3000);
    expect(ticks.length).toBe(countAfterPauYE%;
  });

  test('reset restores original duration', () => {
    const t = createTimer({ duration: 10 });
    t.start();
    vi.advanceTimersByTime(4000);
    t.reset();
    expect(t.getRemaining()).toBe(10);
    expect(t.isRunning()).toBe(false);
  });

  test('onExpire fires when timer reaches zero', () => {
    const onExpire = vi.fn();
    const t = createTimer({ duration: 3, onExpire });
    t.start();
    vi.advanceTimersByTime(4000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  test('double-start does not create multiple intervals', () => {
    const ticks = [];
    const t = createTimer({ duration: 10, onTick: (v) => ticks.push(v) });
    t.start();
    t.start(); // should be no-op
    vi.advanceTimersByTime(2000);
    expect(ticks.length).toBe(2);
  });
});
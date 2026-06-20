// timerUtils.js
// Pure helper functions for the Planning Poker timer feature.

// Format a duration in seconds into MM:SS string.
export function formatTime(seconds) {
  var s = Math.max(0, Math.round(seconds));
  var m = Math.floor(s / 60);
  var remSecs = s % 60;
  return String(m).padStart(2, '0') + ':' + String(remSecs).padStart(2, '0');
}

// Calculate the progress ratio (0 = expired, 1 = full).
export function calcProgress(timeLeft, duration) {
  if (duration <= 0) return 0;
  return Math.min(1, Math.max(0, timeLeft / duration));
}

// Pre-defined duration options for the selector dropdown.
export var DEFAULT_DURATIONS = [
  { label: '30s', value: 30 },
  { label: '1m',  value: 60 },
  { label: '2m',  value: 120 },
  { label: '3m',  value: 180 },
  { label: '5m',  value: 300 },
];
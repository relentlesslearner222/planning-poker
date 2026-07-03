/**
 * TimerDisplay.jsx
 *
 * Props:
 *   timerSync: { remaining: number, running: boolean, totalDuration: number }
 *   isHost: boolean (unused in display but passed for flexibility)
 *
 * Bug fixes applied:
 *   1. CIRCUMFERE8CE → CIRCUMFERENCE (ReferenceError)
 *   2. className=x`...` → className={`...`} (JSX syntax error)
 */

const RADIUS = 54; // SVG circle radius
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const styles = `
  .timer-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .timer-text {
    font-size: 2.2rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #222;
  }
  .timer-text.pulse-red {
    color: #e03131;
    animation: pulse 1s ease-in-out infinite;
  }
  .arc-stroke.pulse-red {
    stroke: #e03131;
    animation: pulse 1s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
`;

function formatTime(ms) {
  const totalSecs = Math.ceil(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function TimerDisplay({ timerSync, isHost }) {
  if (!timerSync) return null;

  const { remaining = 0, totalDuration = 60000 } = timerSync;
  const isWarning = remaining <= 10000 && remaining > 0;
  const progress = totalDuration > 0 ? remaining / totalDuration : 0;
  const offset = CIRCUMFERENCE * (1 - progress);

  return (
    <>
      <style>{styles}</style>
      <div className="timer-wrapper">
        <svg width="130" height="130" viewBox="0 0 130 130">
          {/* Background track */}
          <circle
            cx="65"
            cy="65"
            r={RADIUS}
            fill="none"
            stroke="#e9ecef"
            strokeWidth="8"
          />
          {/* Progress arc */}
          <circle
            className={`arc-stroke${isWarning ? ' pulse-red' : ''}`}
            cx="65"
            cy="65"
            r={RADIUS}
            fill="none"
            stroke={isWarning ? '#e03131' : '#428ca8'}
            strokeWidth="8"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 65 65)"
          />
        </svg>
        <span className={`timer-text${isWarning ? ' pulse-red' : ''}`}>
          {formatTime(remaining)}
        </span>
      </div>
    </>
  );
}

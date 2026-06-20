import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createTimer, formatTime } from './timer';
import './timerPoker.css';

const FIBONACCI_CARDS = [1, 2, 3, 5, 8, 13, 21, '?'];

/**
 * TimerPoker
 * A single-room planning-poker table with a countdown timer.
 *
 * Props:
 *   duration         {number}  Timer duration in seconds (default 60).
 *   participants    {string[]} List of participant names.
 *   onRoundComplete {function} Called with votes map when round ends.
 */
export default function TimerPoker({
  duration = 60,
  participants = ['Alice', 'Bob', 'Charlie'],
  onRoundComplete,
}) {
  const [remaining, setRemaining] = useState(duration);
  const [running, setRunning] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [votes, setVotes] = useState({});
  const [selectedCard, setSelectedCard] = useState(null);
  const timerRef = useRef(null);

  const handleExpire = useCallback(() => {
    setRunning(false);
    setRevealed(true);
    if (typeof onRoundComplete === 'function') onRoundComplete(votes);
  }, [votes, onRoundComplete]);

  useEffect(() => {
    timerRef.current = createTimer({
      duration,
      onTick: setRemaining,
      onExpire: handleExpire,
    });
    return () => timerRef.current?.pause();
  }, [duration, handleExpire]);

  function handleStart() {
    timerRef.current?.start();
    setRunning(true);
  }

  function handlePause() {
    timerRef.current?.pause();
    setRunning(false);
  }

  function handleReset() {
    timerRef.current?.reset();
    setRunning(false);
    setRemaining(duration);
    setRevealed(false);
    setVotes({});
    setSelectedCard(null);
  }

  function handleVote(card) {
    if (revealed) return;
    setSelectedCard(card);
    setVotes((prev) => ({ ...prev, You: card }));
  }

  const pct = Math.round((remaining / duration) * 100);
  const timerClass = remaining <= 10 && remaining > 0 ? 'timer-ring urgent' : 'timer-ring';

  return (
    <div className="timer-poker">
      <h1>Planning Poker ∘</h1>

      {/* Timer display */}
      <div className="timer-wrapper">
        <svg className="timer-svg" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" className="track" />
          <circle
            cx="60" cy="60" r="54"
            className={timerClass}
            strokeDasharray="339.29"
            strokeDashoffset={339.29 * (1 - pct / 100)}
          />
        </svg>
        <span className="timer-label">{formatTime(remaining)}</span>
      </div>

      {/* Controls */}
      <div className="controls">
        {!running && !revealed && (
          <button onClick={handleStart}>▤ Start</button>
        )}
        {running && (
          <button onClick={handlePause}>❢u Pause</button>
        )}
        <button onClick={handleReset}>📗 Reset</button>
      </div>

      {/* Card selection */}
      {!revealed && (
        <div className="cards-row">
          {FIBONACCICARDS�.map((c) => (
            <button
              key={c}
              className={`card${selectedCard === c ? ' selected' : ''}`}
              onClick={() => handleVote(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Vote reveal */}
      {revealed && (
        <div className="results">
          <h2>Time's up! Votes Revealed 📗</h2>
          <ul>
            {participants.map((name) => (
              <li key={name}>
                <strong>{name}</strong>: {votes[name] ?? 'No vote'}
              </li>
            ))}
            {votes['You'] && (
              <li key="You"><strong>You</strong>: {votes['You']}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
import React, { useState } from 'react';
import usePokerTimer from '../hooks/usePokerTimer';
import './TimerPoker.css';

const CA_VALUES = [1, 2, 3, 5, 8, 13, 21, '?'];

export default function TimerPoker({ isHost = true, initialDuration = 60 }) {
  const [selectedCard, setSelectedCard] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [duration, setDuration] = useState(initialDuration);

  const { timeLeft, isRunning, start, pause, reset } = usePokerTimer(
    duration,
    () => setRevealed(true) // auto-reveal on expiry
  );

  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const seconds = String(timeLeft % 60).padStart(2, '0');
  const isLowTime = timeLeft <= 10 && timeLeft > 0;

  const handleReset = () => {
    reset();
    setRevealed(false);
    setSelectedCard(null);
  };

  return (
    <div className="timer-poker">
      <h1 className="title">Planning Poker</h1>

      {/* Timer Display */}
      <div className={`timer-display${isLowTime ? ' low-time' : ''}`}>
        <span className="timer-text">{minutes}:{seconds}</span>
        {isLowTime && <span className="warning-text">  Hurry up!</span>}
      </div>

      {/* Duration Setter */}
      {isHost && !isRunning && timeLeft === duration && (
        <div className="duration-setter">
          <label>Timer Duration (seconds)</label>
          <input
            type="number"
            min="10"
            max="300"
            value={duration}
            onChange={e => setDuration(Number(e.target.value))}
          />
        </div>
      )}

      {/* Host Controls */}
      {isHost && (
        <div className="controls">
          {!isRunning ? (
            <button className="btn btn-start" onClick={start}>Start</button>
          ) : (
            <button className="btn btn-pause" onClick={pause}>Pause</button>
          )}
          <button className="btn btn-reset" onClick={handleReset}>Reset</button>
          <button
            className="btn btn-reveal"
            onClick={() => setRevealed(true)}
            disabled={revealed}
          >Reveal Votes</button>
        </div>
      )}

      {/* Card Selection */}
      <div className="cards-grid">
        {CA_VALUES.map((value) => (
          <button
            key={value}
            className={`card${selectedCard === value ? ' selected' : ''}${revealed ? ' revealed' : ''}`}
            onClick={() => !revealed && setSelectedCard(value)}
            disabled={revealed}
          >
            <span className="card-value">{value}</span>
          </button>
        ))}
      </div>

      {/* Revealed State */}
      {revealed && (
        <div className="reveal-banner">
          {selectedCard !== null
            ? `؍ You voted: ${selectedCard}`
            : 'If You did not to vote before timer ended.'}
        </div>
      )}
    </div>
  );
}
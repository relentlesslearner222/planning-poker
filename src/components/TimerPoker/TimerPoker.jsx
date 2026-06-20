import React, { useState } from 'react';
import usePokerTimer from './usePokerTimer';
import './TimerPoker.css';

const DECK = [1, 2, 3, 5, 8, 13, 21, '?'];
const DEFAULT_SECONDS = 60;

/**
 * TimerPoker
 * A Planning Poker session with a countdown timer.
 * Votes are auto-revealed when the timer hits 0.
 */
export default function TimerPoker({ durationSeconds = DEFAULT_SECONDS }) {
  const [votes, setVotes] = useState({});
  const [revealed, setRevealed] = useState(false);
  const [localPlayer] = useState('You');

  const onTimerEnd = () => setRevealed(true);

  const { timeLeft, isRunning, start, pause, reset } = usePokerTimer({
    durationSeconds,
    onTimerEnd,
  });

  const handleVote = (card) => {
    if (revealed || !isRunning) return;
    setVotes((prev) => ({ ...prev, [localPlayer]: card }));
  };

  const handleReset = () => {
    setVotes({});
    setRevealed(false);
    reset();
  };

  const urgent = timeLeft <= 10 && timeLeft > 0;
  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');

  const voteCount = Object.keys(votes).length;
  const selectedCard = votes[localPlayer];

  return (
    <div className="tp-wrapper">
      <h1 className="tp-title">Planning Poker &#12318;</h1>

      {/* ---- Timer Display ---- */}
      <div className={`tp-timer${urgent ? ' tp-timer--urgent' : ''}`}>
        <span className="tp-timer-digits">
          {mins}:{Secs}
        </span>
        {urgent && <span className="tp-urgent-badge">Hurry up!</span>}
      </div>

      {/* ---- Timer Controls ---- */}
      <div className="tp-controls">
        {!isRunning && timeLeft === durationSeconds && (
          <button className="tp-btn tp-btn--primary" onClick={start}>
            Start Timer
          </button>
        )}
        {isRunning && (
          <button className="tp-btn tp-btn--warning" onClick={pause}>
            Pause
          </button>
        )}
        {!isRunning && timeLeft < durationSeconds && timeLeft > 0 && (
          <button className="tp-btn tp-btn--primary" onClick={start}>
            Resume
          </button>
        )}
        {!votes && isRunning && voteCount > 0 && (
          <button
            className="tp-btn tp-btn--success"
            onClick={() => setRevealed(true)}
          >
            Reveal Votes
          </button>
        )}
        <button className="tp-btn tp-btn--secondary" onClick={handleReset}>
          Reset
        </button>
      </div>

      {/* ---- Card Deck ---- */}
      <section className="tp-deck-section">
        <h2 className="tp-section-title">Pick a card</h2>
        <div className="tp-deck">
          {DECK.map((card) => (
            <button
              key={card}
              className={`tp-card${selectedCard === card ? ' tp-card--selected' : ''}`}
              onClick={() => handleVote(card)}
              disabled={revealed || !isRunning}
            >
              {card}
            </button>
          ))}
        </div>
      </section>

      {/* ---- Results ---- */}
      {revealed && (
        <section className="tp-results">
          <h2 className="tp-section-title">Results</h2>
          {voteCount === 0 ? (
            <p className="tp-no-votes">No votes were cast.</p>
          ) : (
            <ul className="tp-results-list">
              {Object.entries(votes).map(([player, vote]) => (
                <li key={player}>
                  <span className="tp-player">{player}</span>
                  <span className="tp-vote-badge">{vote}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
import React, { useState, useCallback } from 'react';
import Timer from './Timer';
import { useTimer } from '../hooks/useTimer';

const DEFAULT_DURATION = 60;

/**
 * PokerRoom - orchestrates the voting workflow with a countdown timer.
 * Props: isHost, story, players, onValueSelected, onReveal
 */
export default function PokerRoom({
  isHost = false,
  story = '',
  players = [],
  onValueSelected,
  onReveal,
}) {
  const [votesRevealed, setVotesRevealed] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  const handleExpiry = useCallback(() => {
    setVotesRevealed(true);
    if (typeof onReveal === 'function') onReveal();
  }, [onReveal]);

  const { secondsLeft, isRunning, start, pause, reset } = useTimer(DEFAULT_DURATION, handleExpiry);

  const handleResetRound = useCallback(() => {
    reset();
    setVotesRevealed(false);
    setSelectedCard(null);
  }, [reset]);

  const handleCardSelect = useCallback((card) => {
    if (votesRevealed) return;
    setSelectedCard(card);
    if (typeof onValueSelected === 'function') onValueSelected(card);
  }, [votesRevealed, onValueSelected]);

  const FIB_CARDS = ['1', '2', '3', '5', '8', '13', '21', '?'];

  return (
    <div className="poker-room">
      <h2 className="story-title">{story || 'No story selected'}</h2>

      <section className="timer-section">
        <Timer
          secondsLeft={secondsLeft}
          totalSeconds={DEFAULT_DURATION}
          isRunning={isRunning}
          onStart={start}
          onPause={pause}
          onReset={handleResetRound}
          isHost={isHost}
        />
      </section>

      <section className={`card-deck${votesRevealed ? ' locked' : ''}`}>
        {FIB_CARDS.map((card) => (
          <button
            key={card}
            className={`poker-card${selectedCard === card ? ' selected' : ''}`}
            onClick={() => handleCardSelect(card)}
            disabled={votesRevealed}
          >
            {card}
          </button>
        ))}
      </section>

      {isHost && !votesRevealed && (
        <button
          className="btn-reveal"
          onClick={() => { setVotesRevealed(true); if (onReveal) onReveal(); }}
        >
          Reveal Votes
        </button>
      )}

      {votesRevealed && players.length > 0 && (
        <section className="player-votes">
          <h3>Votes</h3>
          <ul>
            {players.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <strong>{p.vote != null ? p.vote : '-'}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

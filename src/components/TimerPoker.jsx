import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createTimer, formatTime } from '../timer';
import './TimerPoker.css';

const DEFAULT_CARDS = ['0','1','2','3','5','8','13','21','?','❎];
const DEFAULT_DURATION = 60;

export default function TimerPoker({ durationSeconds = DEFAULT_DURATION, cards = DEFAULT_CARDS, onReveal }) {
  const [remaining, setRemaining]   = useState(durationSeconds);
  const [running, setRunning]       = useState(false);
  const [revealed, setRevealed]     = useState(false);
  const [selectedCard, setSelected] = useState(null);
  const [votes, setVotes]           = useState([]);
  const timerRef                    = useRef(null);

  useEffect(() => {
    timerRef.current = createTimer({
      durationSeconds,
      onTick: (s) => setRemaining(s),
      onExpire: () => { setRunning(false); setRevealed(true); },
    });
    setRemaining(durationSeconds);
    setRunning(false); setRevealed(false); setSelected(null); setVotes([]);
    return () => timerRef.current?.pause();
  }, [durationSeconds]);

  const handleStart  = useCallback(() => { timerRef.current?.start(); setRunning(true); }, []);
  const handlePause  = useCallback(() => { timerRef.current?.pause(); setRunning(false); }, []);
  const handleReset  = useCallback(() => {
    timerRef.current?.reset();
    setRemaining(durationSeconds); setRunning(false); setRevealed(false); setSelected(null); setVotes([]);
  }, [durationSeconds]);
  const handleReveal = useCallback(() => {
    timerRef.current?.pause(); setRunning(false); setRevealed(true);
    if (typeof onReveal === 'function') onReveal(votes);
  }, [votes, onReveal]);
  const handleCardSelect = useCallback((card) => {
    if (revealed) return;
    setSelected(card);
    setVotes((prev) => [...prev.filter((v) => v.participant !== 'You'), { participant: 'You', card }]);
  }, [revealed]);

  const progress        = remaining / durationSeconds;
  const circumference   = 2 * Math.PI * 54;
  const strokeDashoffset = circumference * (1 - progress);
  const isUrgent        = remaining <= 10 && remaining > 0;
  const isExpired       = remaining === 0;

  return (
    <div className="tp-wrapper">
      <header className="tp-header">
        <h1 className="tp-title">⏱ Timer Poker</h1>
        <p className="tp-subtitle">Select your estimate before the timer runs out!</p>
      </header>

      <div className={`tp-clock ${isUrgent ? 'tp-clock--urgent' : ''} ${isExpired ? 'tp-clock--expired' : ''}`}>
        <svg viewBox="0 0 120 120" className="tp-svg">
          <circle cx="60" cy="60" r="54" className="tp-track" />
          <circle cx="60" cy="60" r="54" className="tp-progress"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 60 60)" />
        </svg>
        <span className="tp-time-label">{isExpired ? "Time's up!" : formatTime(remaining)}</span>
      </div>

      <div className="tp-controls">
        {!running && !revealed && <button className="tp-btn tp-btn--start" onClick={handleStart} disabled={isExpired}>{remaining === durationSeconds ? '➶ Start' : '▶ Resume'}</button>}
        {running && <button className="tp-btn tp-btn--pause" onClick={handlePause}>⎈ Pause</button>}
        <button className="tp-btn tp-btn--reset" onClick={handleReset}>↊ Reset</button>
        {!revealed && <button className="tp-btn tp-btn--reveal" onClick={handleReveal}>🃏 Reveal</button>}
      </div>

      {!revealed && (
        <section className="tp-cards">
          {cards.map((card) => (
            <button key={card} className={`tp-card ${selectedCard === card ? 'tp-card--selected' : ''}`}
              onClick={() => handleCardSelect(card)} aria-pressed={selectedCard === card}>{card}</button>
          ))}
        </section>
      )}

      {revealed && (
        <section className="tp-results" aria-live="polite">
          <h2 className="tp-results__title">Round Results</h2>
          {votes.length === 0 ? <p className="tp-results__empty">No votes were cast.</p> : (
            <ul className="tp-results__list">
              {votes.map(({ participant, card }) => (
                <li key={participant} className="tp-results__item">
                  <span className="tp-results__participant">{participant}</span>
                  <span className="tp-results__card">{card}</span>
                </li>
              ))}
            </ul>
          )}
          <button className="tp-btn tp-btn--reset" onClick={handleReset}>↪ New Round</button>
        </section>
      )}
    </div>
  );
}
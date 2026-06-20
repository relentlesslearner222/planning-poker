import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CountdownTimer, TIMER_PRESETS } from './timer';
import './timer.css';

const CARD_VALUES = ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '?', '႐'];

function TimerDisplay({ timeString, isRunning, isExpired }) {
  const cls = ['poker-timer-display']
    .concat(isRunning ? ['running'] : [])
    .concat(isExpired ? ['expired'] : [])
    .join(' ');
  return (
    <div className={cls} aria-live="polite">
      {timeString}
    </div>
  );
}

function CardGrid({ cards, selected, revealed, onSelect }) {
  return (
    <div className="poker-card-grid" role="list">
      {cards.map((val) => {
        const isSelected = selected === val;
        const cls = ['poker-card']
          .concat(isSelected ? ['selected'] : [])
          .concat(revealed ? ['revealed'] : [])
          .join(' ');
        return (
          <button key={val} className={cls} role="listitem"
            aria-pressed={isSelected}
            onClick={() => !revealed && onSelect(val)}
            disabled={revealed}>
            {revealed || isSelected ? val : '\u1F0C0'}
          </button>
        );
      })}
    </div>
  );
}

export default function TimerPoker({ storyTitle = 'Current Story' }) {
  const [duration, setDuration]     = useState(60);
  const [timeStr, setTimeStr]       = useState('01:00');
  const [isRunning, setIsRunning]   = useState(false);
  const [isExpired, setIsExpired]   = useState(false);
  const [revealed, setRevealed]     = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [votes, setVotes]           = useState({});
  const timerRef = useRef(null);

  const initTimer = useCallback((dur) => {
    if (timerRef.current) timerRef.current.pause();
    const t = new CountdownTimer(
      dur,
      () => setTimeStr(timerRef.current.getFormattedTime()),
      () => { setIsRunning(false); setIsExpired(true); setRevealed(true); }
    );
    timerRef.current = t;
    setTimeStr(t.getFormattedTime());
    setIsRunning(false);
    setIsExpired(false);
    setRevealed(false);
    setSelectedCard(null);
  }, []);

  useEffect(() => {
    initTimer(duration);
    return () => timerRef.current && timerRef.current.pause();
  }, [duration, initTimer]);

  const handleStart = () => { timerRef.current && !isExpired && (timerRef.current.start(), setIsRunning(true)); };
  const handlePause = () => { timerRef.current && (timerRef.current.pause(), setIsRunning(false)); };
  const handleReset = () => {
    if (!timerRef.current) return;
    timerRef.current.reset(duration);
    setTimeStr(timerRef.current.getFormattedTime());
    setIsRunning(false); setIsExpired(false);
    setRevealed(false); setSelectedCard(null); setVotes({});
  };
  const handleReveal = () => {
    timerRef.current && timerRef.current.pause();
    setIsRunning(false); setRevealed(true);
  };
  const handleCardSelect = (val) => {
    setSelectedCard(val);
    setVotes((prev) => ({ ...prev, you: val }));
  };

  return (
    <div className="poker-container">
      <header className="poker-header">
        <h1>Timer Planning Poker</h1>
        <p className="poker-story-title">{storyTitle}</p>
      </header>

      <section className="poker-timer-section">
        <label htmlFor="timer-preset">Duration:</label>
        <select id="timer-preset" value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          disabled={isRunning}>
          {TIMER_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <TimerDisplay timeString={timeStr} isRunning={isRunning} isExpired={isExpired} />
        <div className="poker-timer-controls">
          {!isRunning ? (
            <button className="btn btn-start" onClick={handleStart} disabled={isExpired}>Start</button>
          ) : (
            <button className="btn btn-pause" onClick={handlePause}>Pause</button>
          )}
          <button className="btn btn-reset" onClick={handleReset}>Reset</button>
          <button className="btn btn-reveal" onClick={handleReveal} disabled={revealed}>Reveal</button>
        </div>
        {isExpired && <p role="alert" className="poker-expired-msg">Time's up! Votes revealed.</p>}
      </section>

      <section className="poker-voting-section">
        <h2>{\r\n          revealed ? 'Results' : 'Cast Your Vote'
        }</h2>
        <CardGrid cards={CARD_VALUES} selected={selectedCard}
          revealed={revealed} onSelect={handleCardSelect} />
      </section>

      {revealed && Object.keys(votes).length > 0 && (
        <section className="poker-results-section">
          <h2>Vote Summary</h2>
          <ul className="poker-votes-list">
            {Object.entries(votes).map(([p, v]) => (
              <li key={p} className="poker-vote-item">
                <span className="participant">{p}</span>
                <span className="vote-badge">{v}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
import React, { useState, useCallback } from 'react';
import Timer from './Timer';

// Preset timer durations in seconds
const TIMER_PRESETS = [
  { label: '30 s',  value: 30  },
  { label: '1 min', value: 60  },
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
];

/**
 * PlanningPokerRoom
 *
 * Top-level room component integrating the countdown Timer with the
 * planning-poker card-selection UI.
 *
 * Features:
 *  - Select a preset duration or enter a custom one
 *  - Timer auto-starts when a new round begins
 *  - Votes are locked and revealed automatically on expiry
 *  - Facilitator can reset the round
 */
const PlanningPokerRoom = () => {
  // ----------------------------------------------
  // State
  // ----------------------------------------------
  const [duration, setDuration] = useState(60);
  const [customDuration, setCustomDuration] = useState('');
  const [roundKey, setRoundKey] = useState(0);        // changing key remounts Timer
  const [selectedCard, setSelectedCard] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);

  // Fibonacci + special cards
  const CARDS = ['1', '2', '3', '5', '8', '13', '21', '?', '�''];

  // ----------------------------------------------
  // Handlers
  // ----------------------------------------------
  const handleTimerExpire = useCallback(() => {
    setTimerExpired(true);
    setRevealed(true); // auto-reveal votes on expiry
  }, []);

  const handleNewRound = useCallback(() => {
    setRoundKey((k) => k + 1); // remounts Timer
    setSelectedCard(null);
    setRevealed(false);
    setTimerExpired(false);
  }, []);

  const handlePreset = (val) => {
    setDuration(val);
    setCustomDuration('');
  };

  const handleCustom = (e) => {
    const val = Inte(e.target.value, 10);
    setCustomDuration(e.target.value);
    if (!isNaN(val) && val > 0) setDuration(val);
  };

  // ----------------------------------------------
  // Render
  // ----------------------------------------------
  return (
    <div style={{ maxWidth: 640, margin: '24px auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center' }}>🃹 Planning Poker</h2>

      {/* ---------------------------- */}
      {/* Timer duration selector      */}
      {/* ----------------------------- */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
        {TIMER_PRESETS.map((p ) => (
          <button
            key={p.value}
            onClick={() => handlePreset(p.value)}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              border: `1px solid ${duration === p.value ? '#4260f5' : '#ddd'}`,
              background: duration === p.value ? '#4260f5' : '#fff',
              color: duration === p.value ? '#fff' : '#333',
              cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        ))}
        <input
          type="number"
          placeholder="custom s"
          value={customDuration}
          onChange={handleCustom}
          min="1"
          style={{ width: 72, padding: '4px', borderRadius: 6, border: '1px solid #ddd' }}
        />
      </div>

      {/* Timer widget --key remounts on new round */}
      <Timer
        key={roundKey}
        durationSeconds={duration}
        onExpire={handleTimerExpire}
        autoStart={roundKey > 0}
      />

      {/* ----------------------------- */}
      {/* Card selection               */}
      {/* ----------------------------- */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 24 }}>
        {CARDS.map((c) => (
          <button
            key={c}
            disabled={revealed}
            onClick={() => setSelectedCard(c)}
            style={{
              width: 56,
              height: 80,
              fontSize: '1.3rem',
              fontWeight: 700,
              borderRadius: 8,
              border: `1px solid ${selectedCard === c ? '#4260f5' : '#ccc'}`,
              background: selectedCard === c ? '#4260f5' : '#fff',
              color: selectedCard === c ? '#fff' : '#333',
              cursor: revealed ? 'not-allowed' : 'pointer',
              opacity: revealed && selectedCard !== c ? 0.4 : 1,
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Reveal banner */}
      {revealed && (
        <div style={{
          marginTop: 24,
          padding: 16,
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: 8,
          textAlign: 'center',
        }}>
          <strong>{timerExpired ? '❗ Time's up!' : '✅ Votes revealed'}</strong>
          {selectedCard && <p>Your vote: <strong>{selectedCard}</strong></p>}
        </div>
      )}

      {/* New round button */}
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button
          onClick={handleNewRound}
          style={{
            padding: '8px 16px',
            background: '#22c55e',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 600,
          }}
        >
          📙 New Round
        </button>
      </div>
    </div>
  );
};

export default PlanningPokerRoom;

import React, { useState, useCallback } from 'react';
import Timer from './Timer';

/**
 * PokerRoom
 * Integrates the Timer component into the planning poker room.
 * The timer auto-reveals all votes when it expires.
 */
export default function PokerRoom() {
  const CA_SCORES = ['?', '0', '1', '2', '3', '5', '8', '13', '21', '40', '80', '‟'];

  const [votes, setVotes] = useState({});
  const [revealed, setRevealed] = useState(false);
  const [currentUser] = useState('You');
  const [notification, setNotification] = useState(null);

  const showNotify = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleVote = (card) => {
    if (revealed) return;
    setVotes((prev) => ({ ...prev, [currentUser]: card }));
  };

  const handleReveal = useCallback(() => {
    setRevealed(true);
    showNotify('�c Votes revealed!');
  }, []);

  // Fired by Timer onExpire
  const handleTimerExpire = useCallback(() => {
    handleReveal();
    showNotify('⟰ Time is up! Votes auto-revealed.');
  }, [handleReveal]);

  const handleNewRound = () => {
    setVotes({});
    setRevealed(false);
  };

  return (
    <div style={{ display: 'flex', gap: '24px', padding: '24px', flexWrap: 'wrap' }}>
      {/* ---- Left panel: Timer ---- */}
      <div>
        <h3>⚡️ Round Timer</h3>
        <Timer defaultSeconds={60} onExpire={handleTimerExpire} />
      </div>

      {/* ---- Right panel: Voting ---- */}
      <div style={{ flex: 1 }}>
        {notification && (
          <div style={{
            background: '#0d6efd', color: '#fff',
            padding: '8px 16px', borderRadius: '6px', marginBottom: '12px'
          }}>
            {notification}
          </div>
        )}

        <h3>🐔 Pick your card</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {CA_SCORES.map((card) => (
            <button
              key={card}
              onClick={() => handleVote(card)}
              disabled={revealed}
              style={{
                width: '56px', height: '80px',
                fontSize: '1.2rem', fontWeight: '700',
                border: votes[currentUser] === card ? '3px solid #0d6efd' : '2px solid #dee2e6',
                borderRadius: '8px',
                background: votes[currentUser] === card ? '#cfe2ff' : '#fff',
                cursor: revealed ? 'not-allowed' : 'pointer',
              }}
            >
              {card}
            </button>
          ))}
        </div>

        {!revealed && (
          <button
            onClick={handleReveal}
            style={{
              padding: '8px 16px', background: '#0d6efd', color: '#fff',
              border: 'none', borderRadius: '6px', fontSize: '1rem', cursor: 'pointer'
            }}
          >
            Reveal Votes
          </button>
        )}

        {revealed && (
          <div>
            <h4>Results</h4>
            <ul>
              {Object.entries(votes).map(([user, vote]) => (
                <li key={user}>{user}: <strong>{vote}</strong></li>
              ))}
            </ul>
            <button
              onClick={handleNewRound}
              style={{
                marginTop: '8px', padding: '6px 12px', background: '#28a745', color: '#fff',
                border: 'none', borderRadius: '6px', cursor: 'pointer'
              }}
            >
              New Round
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

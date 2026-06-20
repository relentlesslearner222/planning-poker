import React, { useState, useCallback } from 'react';
import PokerTimer from './PokerTimer';

const SCORE_CARDS = ['1', '2', '3', '5', '8', '13', '21', '?'];

/**
 * TimerPokerRoom - A full planning poker session room with an integrated timer.
 *
 * Props:
 *  @param {string}  roomName         - Name/title of the current story/room
 *  @param {boolean} isHost           - Whether the current user is the host
 *  @param {number}  timerDuration    - Duration in seconds (default: 60)
 *  @param {array}   participants     - Array of participant objects {id, name, vote}
 */
const TimerPokerRoom = ({
  roomName = 'Story #1',
  isHost = true,
  timerDuration = 60,
  participants = [],
}) => {
  const [selectedCard, setSelectedCard] = useState(null);
  const [revealed, setRevealed] = useState(false);

  // Fired when the countdown timer reaches zero -- auto-reveal votes
  const handleTimerExpire = useCallback(() => {
    setRevealed(true);
  }, []);

  const handleCardSelect = (card) => {
    if (revealed) return;
    setSelectedCard(card);
  };

  const handleNewRound = () => {
    setSelectedCard(null);
    setRevealed(false);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>💓 Planning Poker</h1>
        <p style={styles.subtitle}>{roomName}</p>
      </header>

      {/* Timer section */}
      <section style={styles.timerSection}>
        <PokerTimer
          durationSeconds={timerDuration}
          isHost={isHost}
          onExpire={handleTimerExpire}
          warnAtSeconds={10}
        />
      </section>

      {/* Voting cards */}
      <section style={styles.cardsSection}>
        <h3 style={styles.sectionHeading}>
          {revealed ? 'Votes Revealed!' : 'Pick your card:'}
        </h3>
        <div style={styles.cardsGrid}>
          {SCORE_CARDS.map((card) => (
            <button
              key={card}
              style={{
                ...styles.card,
                ...(selectedCard === card ? styles.cardSelected : {}),
                opacity: revealed ? 0.5 : 1,
                cursor: revealed ? 'not-allowed' : 'pointer',
              }}
              onClick={() => handleCardSelect(card)}
              disabled={revealed}
            >
              {card}
            </button>
          ))}
        </div>
      </section>

      {/* Participants */}
      {participants.length > 0 && (
        <section style={styles.participantsSection}>
          <h3 style={styles.sectionHeading}>Participants</h3>
          <ul style={styles.participantList}>
            {participants.map((p) => (
              <li key={p.id} style={styles.participantItem}>
                <span>{p.name}</span>
                <span style={styles.voteBadge}>
                  {revealed ? (p.vote || '?') : (p.vote ? '✓' : '◥')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {revealed && isHost && (
        <button style={styles.newRoundBtn} onClick={handleNewRound}>
          ♢ Start New Round
        </button>
      )}
    </div>
  );
};

const styles = {
  container: { fontFamily: 'Segoe UI, sans-serif', background: '#12121f', minHeight: '100vh', color: '#e2e2fa', padding: '24px' },
  header: { textAlign: 'center', marginBottom: '24px' },
  title: { fontSize: '2.2rem', margin: 0 },
  subtitle: { opacity: 0.6, marginTop: '4px' },
  timerSection: { display: 'flex', justifyContent: 'center', marginBottom: '28px' },
  cardsSection: { maxWidth: '600px', margin: '0 auto 28px' },
  sectionHeading: { textAlign: 'center', opacity: 0.7 },
  cardsGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' },
  card: { width: '60px', height: '80px', background: '#25253e', border: '2px solid #444460', borderRadius: '8px', color: '#e2e2fa', fontSize: '1.3rem', fontWeight: 700, transition: 'border-color 0.2s' },
  cardSelected: { borderColor: '#6c63ff', background: '#33335a' },
  participantsSection: { maxWidth: '400px', margin: '0 auto' },
  participantList: { listStyle: 'none', padding: 0 },
  participantItem: { display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#25253e', borderRadius: '6px', marginBottom: '6px' },
  voteBadge: { fontWeight: 700, color: '#6c63ff' },
  newRoundBtn: { display: 'block', margin: '24px auto 0', padding: '10px 28px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' },
};

export default TimerPokerRoom;
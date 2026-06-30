import React from 'react';
import FibonacciDeck from './FibonacciDeck';
import ParticipantList from './ParticipantList';
import TimerControls from './TimerControls';
import TimerDisplay from './TimerDisplay';

const styles = {
  page: { minHeight: '100vh', background: '#f8f9fa', padding: '1.5rem' },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    gap: '0.75rem'
  },
  roomLabel: { fontSize: '1.1rem', color: '#495057' },
  roomId: { fontWeight: 700, color: '#428ca8' },
  leaveBtn: {
    padding: '0.45rem 1rem',
    borderRadius: '8px',
    border: '1.5px solid #428ca8',
    background: 'transparent',
    color: '#428ca8',
    fontSize: '0.9rem',
    fontWeight: 600
  },
  main: {
    display: 'grid',
    gridTemplateColumns: '1fr 280px',
    gap: '1.5rem',
    maxWidth: '960px',
    margin: '0 auto'
  },
  section: {
    background: '#fff',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 1px 8px rgba(0,0,0,0.07)'
  },
  sectionTitle: { fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#343a40' },
  hostActions: { display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' },
  btn: {
    padding: '0.5rem 1.2rem',
    borderRadius: '8px',
    border: 'none',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer'
  }
};

export default function PokerRoom({ socket, roomId, isHost, roomState, timerSync, onLeave }) {
  const participants = roomState?.participants || [];
  const revealed = roomState?.revealed || false;
  const myVote = participants.find((p) => p.id === socket?.id)?.vote;

  function handleReveal() {
    socket.emit('vote:reveal');
  }

  function handleReset() {
    socket.emit('vote:reset');
  }

  function handleVote(value) {
    socket.emit('vote:cast', { value });
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <span style={styles.roomLabel}>Room: </span>
          <span style={styles.roomId}>{roomId}</span>
          {isHost && <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#868e96' }}>(host)</span>}
        </div>
        <button style={styles.leaveBtn} onClick={onLeave}>Leave Room</button>
      </div>

      <div style={styles.main}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Vote cards */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Cast your vote</div>
            <FibonacciDeck
              onVote={handleVote}
              selectedValue={revealed ? null : (myVote === '?' ? null : myVote)}
              disabled={revealed}
            />
          </div>

          {/* Participants */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Participants</div>
            <ParticipantList participants={participants} revealed={revealed} />
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Timer */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Timer</div>
            <TimerDisplay timerSync={timerSync} isHost={isHost} />
            {isHost && <TimerControls socket={socket} isTimerActive={timerSync?.running} />}
          </div>

          {/* Host controls */}
          {isHost && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Host Controls</div>
              <div style={styles.hostActions}>
                <button
                  style={{ ...styles.btn, background: '#428ca8', color: '#fff' }}
                  onClick={handleReveal}
                  disabled={revealed}
                >
                  Reveal Votes
                </button>
                <button
                  style={{ ...styles.btn, background: '#f1f3f5', color: '#343a40' }}
                  onClick={handleReset}
                >
                  New Round
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

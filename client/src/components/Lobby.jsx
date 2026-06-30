import React, { useState } from 'react';

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '1.5rem',
    padding: '2rem'
  },
  card: {
    background: '#fff',
    borderRadius: '12px',
    padding: '2.5rem 3rem',
    boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    width: '100%',
    maxWidth: '420px'
  },
  title: { fontSize: '2rem', fontWeight: 700, textAlign: 'center', color: '#428ca8' },
  label: { fontSize: '0.875rem', fontWeight: 600, color: '#495057' },
  input: {
    padding: '0.6rem 0.9rem',
    borderRadius: '8px',
    border: '1.5px solid #ced4da',
    fontSize: '1rem',
    outline: 'none',
    width: '100%'
  },
  button: {
    padding: '0.7rem',
    borderRadius: '8px',
    border: 'none',
    background: '#428ca8',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 600,
    marginTop: '0.5rem'
  },
  status: { fontSize: '0.78rem', textAlign: 'center', color: '#868e96' }
};

export default function Lobby({ onJoin, connected }) {
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const rid = roomId.trim() || generateRoomId();
    const name = userName.trim();
    if (!name) return;
    onJoin(rid, name);
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h1 style={styles.title}>🃏 Planning Poker</h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label style={styles.label}>
            Your name
            <input
              style={{ ...styles.input, marginTop: '0.25rem' }}
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Alice"
              required
            />
          </label>
          <label style={styles.label}>
            Room ID <span style={{ fontWeight: 400, color: '#868e96' }}>(leave blank to create new)</span>
            <input
              style={{ ...styles.input, marginTop: '0.25rem' }}
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="e.g. sprint-42"
            />
          </label>
          <button style={styles.button} type="submit" disabled={!connected}>
            {connected ? 'Join / Create Room' : 'Connecting…'}
          </button>
        </form>
        <p style={styles.status}>{connected ? '● Connected' : '○ Connecting to server…'}</p>
      </div>
    </div>
  );
}

function generateRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

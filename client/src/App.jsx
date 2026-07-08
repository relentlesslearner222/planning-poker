import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import TimerControls from './components/TimerControls';
import TimerDisplay from './components/TimerDisplay';

const socket = io();
const CARD_VALUES = ['0', '1', '2', '3', '5', '8', '13', '?'];

export default function App() {
  const [screen, setScreen] = useState('join');
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [roomState, setRoomState] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [myVote, setMyVote] = useState(null);

  useEffect(() => {
    socket.on('room:state', (state) => setRoomState(state));
    return () => { socket.off('room:state'); };
  }, []);

  function handleJoin(e) {
    e.preventDefault();
    if (!name.trim() || !roomId.trim()) return;
    socket.emit('join', { roomId: roomId.trim(), name: name.trim() }, (ack) => {
      if (ack && ack.isHost) setIsHost(true);
    });
    setScreen('table');
  }

  function handleVote(value) {
    setMyVote(value);
    socket.emit('vote', { value });
  }

  function handleReveal() { socket.emit('reveal'); }

  function handleNewRound() {
    setMyVote(null);
    socket.emit('new-round');
  }

  const timerSync = roomState?.timerSync ?? { remaining: 0, running: false, totalDuration: 0 };
  const isTimerActive = timerSync.running;

  if (screen === 'join') {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Planning Poker</h1>
        <form onSubmit={handleJoin} style={styles.form}>
          <input style={styles.input} type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input style={styles.input} type="text" placeholder="Room code" value={roomId} onChange={(e) => setRoomId(e.target.value)} required />
          <button style={styles.button} type="submit">Join Room</button>
        </form>
      </div>
    );
  }

  const players = roomState?.players ?? [];
  const revealed = roomState?.revealed ?? false;

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Room: {roomId}</h1>
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Players</h2>
        <div style={styles.playerList}>
          {players.map((p, i) => (
            <div key={i} style={styles.playerCard}>
              <span>{p.name}</span>
              <span style={styles.voteIndicator}>{revealed ? (p.value ?? '—') : (p.voted ? '✓' : '…')}</span>
            </div>
          ))}
        </div>
      </div>
      {!revealed && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Your Vote</h2>
          <div style={styles.cardRow}>
            {CARD_VALUES.map((v) => (
              <button key={v} onClick={() => handleVote(v)} style={{ ...styles.card, ...(myVote === v ? styles.cardSelected : {}) }}>{v}</button>
            ))}
          </div>
        </div>
      )}
      {isHost && (
        <div style={styles.section}>
          {!revealed
            ? <button style={styles.button} onClick={handleReveal}>Reveal</button>
            : <button style={styles.button} onClick={handleNewRound}>New Round</button>
          }
        </div>
      )}
      <div style={styles.section}>
        <TimerDisplay timerSync={timerSync} isHost={isHost} />
        {isHost && <TimerControls socket={socket} isTimerActive={isTimerActive} />}
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: '600px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' },
  title: { textAlign: 'center', marginBottom: '24px' },
  form: { display: 'flex', flexDirection: 'column', gap: '12px' },
  input: { padding: '10px 14px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc' },
  button: { padding: '10px 20px', fontSize: '16px', borderRadius: '6px', border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer' },
  section: { marginTop: '24px' },
  sectionTitle: { fontSize: '18px', marginBottom: '12px' },
  playerList: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  playerCard: { padding: '8px 14px', background: '#f3f4f6', borderRadius: '6px', display: 'flex', gap: '8px', alignItems: 'center' },
  voteIndicator: { fontWeight: 'bold', color: '#4f46e5' },
  cardRow: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  card: { width: '56px', height: '80px', fontSize: '22px', fontWeight: 'bold', borderRadius: '8px', border: '2px solid #d1d5db', background: '#fff', cursor: 'pointer' },
  cardSelected: { border: '2px solid #4f46e5', background: '#eef2ff', color: '#4f46e5' },
};

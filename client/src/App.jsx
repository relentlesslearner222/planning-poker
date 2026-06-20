import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:4000');

const VOTE_OPTIONS = ['1', '2', '3', '5', '8', '13', '21', '?'];
const TIMER_PRESETS = [30, 60, 90, 120];

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function App() {
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [roomState, setRoomState] = useState(null);
  const [selectedVote, setSelectedVote] = useState(null);
  const [customDuration, setCustomDuration] = useState('');
  const roomIdRef = useRef(roomId);

  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  useEffect(() => {
    socket.on('roomUpdate', (data) => {
      setRoomState(data);
    });
    return () => { socket.off('roomUpdate'); };
  }, []);

  const isHost = roomState?.hostId === socket.id;
  const timer = roomState?.timer;
  const isUrgent = timer && timer.remaining <= 10 && timer.state === 'running';

  function handleJoin() {
    if (!name.trim() || !roomId.trim()) return;
    socket.emit('joinRoom', { roomId, name });
    setJoined(true);
  }

  function handleVote(v) {
    setSelectedVote(v);
    socket.emit('submitVote', { roomId, vote: v });
  }

  function handleReveal() { socket.emit('revealVotes', { roomId }); }
  function handleReset() {
    setSelectedVote(null);
    socket.emit('resetRoom', { roomId });
  }

  function handleTimerConfig(duration) {
    socket.emit('timerConfig', { roomId, duration });
  }

  function handleCustomDuration() {
    const val = parseInt(customDuration, 10);
    if (isNaN(val) || val < 10 || val > 300) return;
    handleTimerConfig(val);
    setCustomDuration('');
  }

  if (!joined) {
    return (
      <div className="lobby">
        <h1>Planning Poker</h1>
        <input placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Room ID" value={roomId} onChange={e => setRoomId(e.target.value)} />
        <button onClick={handleJoin}>Join Room</button>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>Planning Poker</h1>
        <span className="room-label">Room: <strong>{roomId}</strong></span>
      </header>

      {/* --- TIMER DISPLAY (visible to all) --- */}
      {timer && (
        <div className={`timer-display${isUrgent ? ' urgent' : ''}`}>
          {formatTime(timer.remaining)}
          <span className="timer-state-label">{() => {
            if (timer.state === 'idle') return ' [Idle]';
            if (timer.state === 'running') return ' [Running]';
            if (timer.state === 'paused') return ' [Paused]';
            if (timer.state === 'expired') return ' [Time up!]';
            return '';
          })}</span>
        </div>
      )}

      {/* --- TIMER CONFIG (host only) --- */}
      {isHost && (
        <section className="timer-config">
          <h2>Configure Timer</h2>
          <div className="presets">
            {TIMER_PRESETS.map((s) => (
              <button
                key={s}
                className={timer?.duration === s ? 'preset active' : 'preset'}
                onClick={() => handleTimerConfig(s)}
              >
                {s}s
              </button>
            ))}
          </div>
          <div className="custom-duration">
            <input
              type="number"
              placeholder="Custom (10-300s)"
              min="10"
              max="300"
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
            />
            <button onClick={handleCustomDuration}>Set Custom</button>
          </div>

          {/* Timer controls */}
          <div className="timer-controls">
            {timer?.state !== 'running' && (
              <button onClick={() => socket.emit('timerStart', { roomId })}>
                Start
              </button>
            )}
            {timer?.state === 'running' && (
              <button onClick={() => socket.emit('timerPause', { roomId })}>
                Pause
              </button>
            )}
            {timer?.state === 'paused' && (
              <button onClick={() => socket.emit('timerResume', { roomId })}>
                Resume
              </button>
            )}
            <button onClick={() => socket.emit('timerReset', { roomId })}>
              Reset
            </button>
          </div>
        </section>
      )}

      {/* --- VOTING AREA --- */}
      <section className="voting">
        <h2>Vote</h2>
        <div className="vote-cards">
          {VOTE_OPTIONS.map((v) => (
            <button
              key={v}
              className={`card${selectedVote === v ? ' selected' : ''}${roomState?.revealed ? ' disabled' : ''}`}
              onClick={() => !roomState?.revealed && handleVote(v)}
              disabled={roomState?.revealed}
            >
              {v}
            </button>
          ))}
        </div>
      </section>

      {/* --- PARTICIPANTS --- */}
      <section className="participants">
        <h2>Participants</h2>
        <ul>
          {roomState?.participants.map((p) => (
            <li key={p.id}>
              {p.name} {p.id === roomState.hostId && <span className="host-badge">(host)</span>}
              {roomState.revealed
                ? <strong> {roomState.votes?.[p.id] ?? '-'}</strong>
                : <span className={p.hasVoted ? 'voted' : 'unvoted'}>
                    {p.hasVoted ? '✐' : '...'}
                  </span>}
            </li>
          ))}
        </ul>
      </section>

      {/* --- HOST ACTIONS --- */}
      {isHost && (
        <div className="host-actions">
          {!roomState?.revealed && (
            <button onClick={handleReveal}>Reveal Votes</button>
          )}
          <button onClick={handleReset}>New Round</button>
        </div>
      )}
    </div>
  );
}
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const socket = io('/v', { autoConnect: false });
// Adjust the URL to match your server (e.g. http://localhost:3001)
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';
const socketClient = io(SOCKET_URL, { autoConnect: false });

export default function App() {
  const [roomId, setRoomId] = useState('');
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [room, setRoom] = useState(null);
  const [selectedVote, setSelectedVote] = useState(null);
  const [customDuration, setCustomDuration] = useState(60);
  const socketRef = useRef(null);

  useEffect(() => {
    const s = io(SOCKET_URL);
    socketRef.current = s;

    s.on('roomUpdate', (data) => {
      setRoom(data);
    });

    return () => { s.disconnect(); };
  }, []);

  const isHost = room && socketRef.current && room.hostId === socketRef.current.id;
  const timer = room?.timer || { state: 'idle', duration: 60, remaining: 60 };

  function joinRoom() {
    if (!roomId || !name) return;
    socketRef.current.emit('joinRoom', { roomId, name });
    setJoined(true);
  }

  function submitVote(vote) {
    socketRef.current.emit('submitVote', { roomId, vote });
    setSelectedVote(vote);
  }

  function revealVotes() {
    socketRef.current.emit('revealVotes', { roomId });
  }

  function resetRound() {
    setSelectedVote(null);
    socketRef.current.emit('resetRound', { roomId });
  }

  function setDuration(d) {
    setCustomDuration(d);
    socketRef.current.emit('setTimerDuration', { roomId, duration: d });
  }

  function startTimer() { socketRef.current.emit('startTimer', { roomId }); }
  function pauseTimer() { socketRef.current.emit('pauseTimer', { roomId }); }
  function resumeTimer() { socketRef.current.emit('resumeTimer', { roomId }); }
  function resetTimer() { socketRef.current.emit('resetTimer', { roomId }); }

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const isUrgent = timer.state === 'running' && timer.remaining <= 10;

  if (!joined) {
    return (
      <div className="app">
        <h1>Planning Poker</h1>
        <input placeholder="Room ID" value={roomId} onChange={e => setRoomId(e.target.value)} />
        <input placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
        <button onClick={joinRoom}>Join Room</button>
      </div>
    );
  }

  return (
    <div className="app">
      <h1>Planning Poker — Room: {roomId}</h1>

      {/* --- TIMER DISPLAY --- */}
      <div className={`timer-display${isUrgent ? ' timer-urgent' : ''}`}>
        {formatTime(timer.remaining)}
        <span className="timer-state-badge">{timer.state}</span>
      </div>

      {/* --- HOST: TIMER CONFIG & CONTROLS --- */}
      {isHost && (
        <div className="timer-panel">
          <div className="timer-presets">
            {[30, 60, 90, 120].map(d => (
              <button key={d} onClick={() => setDuration(d)}
                className={timer.duration === d ? 'active' : ''}>
                {d}s
              </button>
            ))}
            <input
              type="number" min="10" max="300"
              placeholder="Custom (10-300s)"
              value={customDuration}
              onChange={e => setCustomDuration(Number(e.target.value))}
              onBlur={e => setDuration(Number(e.target.value))}
            />
          </div>
          <div className="timer-controls">
            {timer.state === 'idle' && <button onClick={startTimer}>Start</button>}
            {timer.state === 'running' && <button onClick={pauseTimer}>Pause</button>}
            {timer.state === 'paused' && <button onClick={resumeTimer}>Resume</button>}
            <button onClick={resetTimer}>Reset Timer</button>
          </div>
        </div>
      )}

      {/* --- PARTICIPANTS --- */}
      <div className="participants">
        <h2>Participants</h2>
        {room?.participants.map((p) => {
          const hasVoted = room.votes[p.id] !== undefined;
          return (
            <div key={p.id} className="participant">
              <span>{p.name}{p.id === room.hostId ? ' 👇' : ''}</span>
              <span className={hasVoted ? 'voted' : 'not-voted'}>
                {room.revealed ? room.votes[p.id] : (hasVoted ? '✓' : '…')}
              </span>
            </div>
          );
        })}
      </div>

      {/* --- VOTING CARDS --- */}
      {!room?.revealed && (
        <div className="voting-cards">
          {([1, 2, 3, 5, 8, 13, 21, 34, 55, '?']).map((v) => (
            <button key={v}
              className={`card${selectedVote === v ? ' selected' : ''}`}
              onClick={() => submitVote(v)}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {/* --- HOST ACTIONS --- */}
      {isHost && (
        <div className="host-actions">
          {!room.revealed && <button onClick={revealVotes}>Reveal Votes</button>}
          <button onClick={resetRound}>Next Round</button>
        </div>
      )}
    </div>
  );
}
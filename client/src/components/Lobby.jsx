import React, { useState } from 'react';
import { getSocket, useSocketEvent } from '../hooks/useSocket';
import './Lobby.css';

const DEFAULT_TIMER = 60;
const TIMER_OPTIONS = [30, 60, 90, 120, 180];

export default function Lobby({ onJoin }) {
  const [userName, setUserName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [timerDuration, setTimerDuration] = useState(DEFAULT_TIMER);
  const [mode, setMode] = useState('home');
  const [error, setError] = useState('');

  useSocketEvent('room-created', ({ roomId: id, roomState }) => {
    onJoin({ roomId: id, userName, roomState, isHost: true });
  });

  useSocketEvent('joined-room', ({ roomId: id, roomState }) => {
    onJoin({ roomId: id, userName, roomState, isHost: false });
  });

  useSocketEvent('error', ({ message }) => setError(message));

  function handleCreate(e) {
    e.preventDefault();
    if (!userName.trim()) return setError('Enter your name first');
    setError('');
    getSocket().emit('create-room', { name: roomName, userName: userName.trim(), timerDuration });
  }

  function handleJoin(e) {
    e.preventDefault();
    if (!userName.trim()) return setError('Enter your name first');
    if (!roomId.trim()) return setError('Enter a room code');
    setError('');
    getSocket().emit('join-room', { roomId: roomId.toUpperCase().trim(), userName: userName.trim() });
  }

  return (
    <div className="lobby">
      <h1>Planning Poker</h1>
      <div className="name-section">
        <input
          placeholder="Your name"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
        />
      </div>
      {mode === 'home' && (
        <div className="btn-group">
          <button onClick={() => setMode('create')}>Create Room</button>
          <button onClick={() => setMode('join')}>Join Room</button>
        </div>
      )}
      {mode === 'create' && (
        <form onSubmit={handleCreate} className="form-card">
          <h2>Create a Room</h2>
          <input
            placeholder="Room name (optional)"
            value={roomName}
            onChange={(ev) => setRoomName(ev.target.value)}
          />
          <label>Voting Timer</label>
          <select
            value={timerDuration}
            onChange={(ev) => setTimerDuration(Number(ev.target.value))}
          >
            {TIMER_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s >= 60 ? `${s / 60} min` : `${s} sec`}
              </option>
            ))}
          </select>
          <div className="btn-group">
            <button type="submit">Create</button>
            <button type="button" onClick={() => setMode('home')}>Back</button>
          </div>
        </form>
      )}
      {mode === 'join' && (
        <form onSubmit={handleJoin} className="form-card">
          <h2>Join a Room</h2>
          <input
            placeholder="Room Code"
            value={roomId}
            onChange={(ev) => setRoomId(ev.target.value)}
            maxLength={8}
          />
          <div className="btn-group">
            <button type="submit">Join</button>
            <button type="button" onClick={() => setMode('home')}>Back</button>
          </div>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

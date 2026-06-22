import React, { useState, useEffect } from 'react';
import { getSocket, useSocketEvent } from '../hooks/useSocket';
import Timer from './Timer';
import VotingCards from './VotingCards';
import Participants from './Participants';
import Results from './Results';
import './Room.css';

const TIMER_OPTIONS = [30, 60, 90, 120, 180];

export default function Room({ session, onLeave }) {
  const { roomId, userName, isHost } = session;
  const [roomState, setRoomState] = useState(session.roomState);
  const [topic, setTopic] = useState('');
  const [selectedVote, setSelectedVote] = useState(null);
  const [newTimer, setNewTimer] = useState(session.roomState.timerDuration);
  const [copied, setCopied] = useState(false);

  useSocketEvent('room-updated', (state) => setRoomState(state));
  useSocketEvent('timer-started', (state) => {
    setRoomState(state);
    setSelectedVote(null);
  });
  useSocketEvent('timer-tick', ({ timerRemaining, timerRunning }) => {
    setRoomState((prev) => ({ ...prev, timerRemaining, timerRunning }));
  });
  useSocketEvent('timer-expired', (state) => setRoomState(state));
  useSocketEvent('timer-paused', ({ timerRemaining, timerRunning }) => {
    setRoomState((prev) => ({ ...prev, timerRemaining, timerRunning }));
  });
  useSocketEvent('timer-resumed', ({ timerRemaining, timerRunning }) => {
    setRoomState((prev) => ({ ...prev, timerRemaining, timerRunning }));
  });
  useSocketEvent('votes-revealed', (state) => setRoomState(state));

  function handleVote(v) {
    setSelectedVote(v);
    getSocket().emit('submit-vote', { roomId, vote: v });
  }

  function handleStart() {
    getSocket().emit('start-timer', { roomId, topic: topic });
  }

  function handlePause() {
    getSocket().emit('pause-timer', { roomId });
  }

  function handleResume() {
    getSocket().emit('resume-timer', { roomId });
  }

  function handleReveal() {
    getSocket().emit('reveal-votes', { roomId });
  }

  function handleReset() {
    getSocket().emit('reset-round', { roomId, timerDuration: newTimer });
    setSelectedVote(null);
  }

  function copyCode() {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const { participants, timerRemaining, timerDuration, timerRunning, votesRevealed, currentTopic } = roomState;

  return (
    <div className="room">
      <header className="room-header">
        <div>
          <h2>{roomState.name}</h2>
          <span className="room-code" title="Click to copy" onClick={copyCode}>
            {roomId} {copied ? '(Copied!)' : ''}
          </span>
        </div>
        <button className="leave-btn" onClick={onLeave}>Leave</button>
      </header>

      <div className="room-main">
        <div className="timer-section">
          <Timer remaining={timerRemaining} duration={timerDuration} running={timerRunning} />
          {currentTopic && <p className="topic-label">Topic: {currentTopic}</p>}
        </div>

        {isHost && !roomState.votesRevealed && (
          <div className="host-controls">
            <input
              placeholder="Topic / story name"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <select value={newTimer} onChange={(ev) => setNewTimer(Number(iv.target.value))}>
              {TIMER_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s >= 60 ? `${s / 60} min` : `${s} sec`}
                </option>
              ))}
            </select>
            <div className="btn-group">
              {!timerRunning && <button onClick={handleStart}>Start Round</button>}
              {timerRunning && <button onClick={handlePause}>Pause</button>}
              {!timerRunning && timerRemaining < timerDuration && timerRemaining > 0 && (
                <button onClick={handleResume}>Resume</button>
              )}
              <button onClick={handleReveal}>Reveal Votes</button>
            </div>
          </div>
        )}

        {!votesRevealed && (
          <VotingCards
            selectedVote={selectedVote}
            onVote={handleVote}
            disabled={!timerRunning && timerRemaining === timerDuration}
          />
        )}

        <Participants participants={participants} votesRevealed={votesRevealed} />

        {votesRevealed && (
          <>
            <Results participants={participants} />
            {isHost && (
              <div className="btn-group reset-area">
                <label>Next round timer:</label>
                <select value={newTimer} onChange={(ev) => setNewTimer(Number(iv.target.value))}>
                  {TIMER_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s >= 60 ? `${s / 60} min` : `${s} sec`}
                    </option>
                  ))}
                </select>
                <button onClick={handleReset}>Next Round</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

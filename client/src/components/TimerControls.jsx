import React, { useState } from 'react';

/**
 * TimerControls (host only) - AC2
 *
 * Props:
 *   socket         {object}      Socket.io client instance
 *   roomId         {string}      current room id
 *   timerStatus    {string}      'running' | 'paused' | 'stopped'
 *   durationSeconds {number}     server-side duration
 */
export default function TimerControls({ socket, roomId, timerStatus, durationSeconds }) {
  const [inputSeconds, setInputSeconds] = useState(durationSeconds || 60);

  const isRunning = timerStatus === 'running';
  const isPaused  = timerStatus === 'paused';
  const isStopped = timerStatus === 'stopped';

  // Configure duration on input change (only when not running)
  // FIX: emit key is `durationSeconds` per SOCKET_EVENTS.md contract
  const handleDurationChange = (e) => {
    const val = Number(e.target.value);
    setInputSeconds(val);
    if (!isRunning) {
      socket.emit('timer:configure', { roomId, durationSeconds: val });
    }
  };

  const handleStart  = () => socket.emit('timer:start',  { roomId });
  const handlePause  = () => socket.emit('timer:pause',  { roomId });
  const handleResume = () => socket.emit('timer:resume', { roomId });
  const handleReset  = () => socket.emit('timer:reset',  { roomId });

  return (
    <div className="timer-controls">
      <label className="timer-controls__label">
        Duration (seconds):
        <input
          type="number"
          min={10}
          max={300}
          value={inputSeconds}
          onChange={handleDurationChange}
          disabled={isRunning}
          className="timer-controls__input"
        />
      </label>

      <div className="timer-controls__btns">
        {/* Start: disabled when running or paused -- AC2 */}
        <button
          onClick={handleStart}
          disabled={isRunning || isPaused}
          className="btn btn--start"
        >
          Start
        </button>

        {/* Pause: visible only when running -- AC8 */}
        <button
          onClick={handlePause}
          disabled={!isRunning}
          className="btn btn--pause"
        >
          Pause
        </button>

        {/* Resume: visible only when paused -- AC8 */}
        <button
          onClick={handleResume}
          disabled={!isPaused}
          className="btn btn--resume"
        >
          Resume
        </button>

        {/* Reset: always enabled for host -- AC9 */}
        <button
          onClick={handleReset}
          className="btn btn--reset"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
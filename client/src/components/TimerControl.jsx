import React, { useState } from 'react';

/**
 * TimerControl -- Visible only to the room host.
 *
 * Props:
 *   socket      - active Socket.io client socket
 *   timerState  - object from useTimer() { status, remaining, duration }
 */

const PRESET_OPTIONS = [
  { label: '30s',  value: 30_000  },
  { label: '60s',  value: 60_000  },
  { label: '90s',  value: 90_000  },
  { label: '120s', value: 120_000 },
  { label: 'Custom', value: -1    },
];

export default function TimerControl({ socket, timerState }) {
  const [selectedPreset, setSelectedPreset] = useState(60_000);
  const [customSecs, setCustomSecs]         = useState(60);

  const { status } = timerState;
  const isRunning = status === 'running';
  const isIdleOrPaused = status === 'idle' || status === 'paused';

  // ▔ Configure button
  function handleConfigure() {
    const ms =
      selectedPreset === -1
        ? Math.max(1000, Number(customSecs) * 1000)
        : selectedPreset;
    socket.emit('timer:configure', { duration: ms });
  }

  return (
    <div className="timer-control">
      <h3>Timer Controls (Host)</h3>

      {/* Duration selector -- disabled while running */}
      <div className="timer-config">
        <select
          value={selectedPreset}
          onChange={(e) => setSelectedPreset(Number(e.target.value))}
          disabled={isRunning}
        >
          {PRESET_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {selectedPreset === -1 && (
          <input
            type="number"
            min={1}
            max={999}
            value={customSecs}
            onChange={(e) => setCustomSecs(e.target.value)}
            disabled={isRunning}
            placeholder="Seconds"
          />
        )}

        <button
          onClick={handleConfigure}
          disabled={isRunning}
        >
          Set Duration
        </button>
      </div>

      {/* Playback controls */}
      <div className="timer-buttons">
        {isIdleOrPaused && (
          <button onClick={() => socket.emit('timer:start')}>
            ► Start
          </button>
        )}

        {isRunning && (
          <button onClick={() => socket.emit('timer:pause')}>
            ¶ Pause
          </button>
        )}

        <button
          onClick={() => socket.emit('timer:reset')}
          className="btn-reset"
        >
          ¸ Reset
        </button>
      </div>
    </div>
  );
}
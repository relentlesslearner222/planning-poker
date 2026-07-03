function computeStats(revealedVotes) {
  if (!revealedVotes) return null;

  const numericValues = Object.values(revealedVotes)
    .map((v) => parseFloat(v.value))
    .filter((n) => !isNaN(n));

  if (numericValues.length === 0) return null;

  const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);

  // Mode
  const freq = {};
  numericValues.forEach((n) => { freq[n] = (freq[n] || 0) + 1; });
  const maxFreq = Math.max(...Object.values(freq));
  const modes = Object.keys(freq).filter((k) => freq[k] === maxFreq).map(Number);

  return { avg: avg.toFixed(1), min, max, mode: modes.join(', ') };
}

export default function ResultsView({ revealedVotes, participants, isHost, socket }) {
  const stats = computeStats(revealedVotes);

  // Sort participants with voted first
  const entries = participants.map((p) => ({
    ...p,
    vote: revealedVotes ? revealedVotes[p.socketId] : null,
  }));

  function handleNewRound() {
    socket.emit('round:reset');
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6">📊 Voting Results</h2>

      {/* Vote cards grid */}
      <div className="flex flex-wrap gap-3 justify-center mb-6">
        {entries.map(({ socketId, displayName, vote }) => (
          <div
            key={socketId}
            className="flex flex-col items-center gap-1"
          >
            <div
              className={[
                'w-16 h-24 rounded-xl border-2 flex items-center justify-center text-xl font-bold shadow-sm',
                vote
                  ? 'border-brand-primary bg-brand-light text-brand-dark'
                  : 'border-dashed border-gray-300 bg-gray-50 text-gray-400',
              ].join(' ')}
            >
              {vote ? vote.value : '–'}
            </div>
            <span className="text-xs text-gray-500 max-w-[64px] truncate text-center">
              {displayName}
            </span>
          </div>
        ))}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Average', value: stats.avg },
            { label: 'Min', value: stats.min },
            { label: 'Max', value: stats.max },
            { label: 'Mode', value: stats.mode },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              <div className="text-lg font-bold text-brand-dark">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Action area */}
      {isHost ? (
        <div className="flex justify-end">
          <button
            onClick={handleNewRound}
            className="bg-brand-primary hover:bg-brand-dark text-white font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            New Round
          </button>
        </div>
      ) : (
        <div className="text-center py-2">
          <p className="text-gray-500 text-sm italic">Waiting for the host to start a new round…</p>
        </div>
      )}
    </div>
  );
}

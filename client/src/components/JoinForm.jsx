import { useState, useEffect } from 'react';

export default function JoinForm({ roomId, socket }) {
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!socket) return;
    function handleError({ message }) {
      setError(message);
      setSubmitting(false);
    }
    socket.on('room:error', handleError);
    return () => socket.off('room:error', handleError);
  }, [socket]);

  function handleSubmit(e) {
    e.preventDefault();
    const name = displayName.trim();
    if (!name) {
      setError('Please enter your name.');
      return;
    }
    setError('');
    setSubmitting(true);
    socket.emit('room:join', { roomId, displayName: name });
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🃏</div>
        <h2 className="text-2xl font-bold text-gray-800">Join Room</h2>
        <p className="text-gray-500 text-sm mt-1">
          Room <span className="font-mono font-semibold text-brand-primary">{roomId}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
            Your Name
          </label>
          <input
            id="displayName"
            type="text"
            placeholder="e.g. Alice"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={32}
            disabled={submitting}
            autoFocus
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !displayName.trim()}
          className="bg-brand-primary hover:bg-brand-dark text-white font-semibold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Joining…' : 'Join Game'}
        </button>
      </form>
    </div>
  );
}

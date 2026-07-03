export default function ParticipantsPanel({
  participants,
  votes,
  revealedVotes,
  mySocketId,
  revealed,
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
        Players ({participants.length})
      </h2>

      {participants.length === 0 ? (
        <p className="text-gray-400 text-sm">No players yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {participants.map(({ socketId, displayName }) => {
            const isMe = socketId === mySocketId;
            const hasVoted = !!votes[socketId];
            const revealData = revealedVotes ? revealedVotes[socketId] : null;

            return (
              <li
                key={socketId}
                className={[
                  'flex items-center justify-between rounded-lg px-3 py-2 transition-colors',
                  isMe ? 'bg-brand-light border border-brand-primary/20' : 'bg-gray-50',
                ].join(' ')}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">
                    {isMe ? '🙋' : '👤'}
                  </span>
                  <span className={`text-sm font-medium truncate ${isMe ? 'text-brand-dark' : 'text-gray-700'}`}>
                    {displayName}
                    {isMe && <span className="ml-1 text-xs text-gray-400">(you)</span>}
                  </span>
                </div>

                {/* Vote indicator */}
                <div className="flex-shrink-0 ml-2">
                  {revealed && revealData ? (
                    <span
                      className={[
                        'inline-flex items-center justify-center w-10 h-12 rounded-lg border-2 text-base font-bold',
                        isMe
                          ? 'border-brand-primary bg-brand-primary text-white'
                          : 'border-gray-300 bg-white text-gray-800',
                      ].join(' ')}
                    >
                      {revealData.value}
                    </span>
                  ) : revealed && !revealData ? (
                    <span className="inline-flex items-center justify-center w-10 h-12 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 text-xs">
                      –
                    </span>
                  ) : hasVoted ? (
                    <span className="inline-flex items-center justify-center w-10 h-12 rounded-lg border-2 border-green-400 bg-green-50">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15 3.293 9.879a1 1 0 111.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-10 h-12 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
                      <span className="w-3 h-3 rounded-sm bg-gray-200" />
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

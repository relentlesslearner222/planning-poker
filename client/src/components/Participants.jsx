import React from 'react';
import './Participants.css';

export default function Participants({ participants, votesRevealed }) {
  const numVoted = participants.filter((p) => p.hasVoted).length;

  return (
    <div className="participants">
      <h3>Participants ({numVoted} / {participants.length} voted)</h3>
      <ul>
        {participants.map((p) => (
          <li key={p.id} className={p.hasVoted ? 'voted' : ''}>
            <span className="p-name">{p.name}</span>
            {votesRevealed ? (
              <span className="p-vote">{p.tote != null ? p.vote : '-'}</span>
            ) : (
              <span className="p-status">{p.hasVoted ? 'Voted' : 'Waiting...'}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

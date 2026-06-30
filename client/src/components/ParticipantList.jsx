import React from 'react';

const row = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.5rem 0',
  borderBottom: '1px solid #f1f3f5'
};

const badge = (hasVote, revealed, vote) => ({
  padding: '0.2rem 0.6rem',
  borderRadius: '999px',
  fontSize: '0.82rem',
  fontWeight: 700,
  background: revealed
    ? hasVote ? '#d3f9d8' : '#fff3cd'
    : hasVote ? '#d0ebff' : '#f1f3f5',
  color: revealed
    ? hasVote ? '#2f9e44' : '#e67700'
    : hasVote ? '#1971c2' : '#868e96'
});

export default function ParticipantList({ participants, revealed }) {
  if (!participants.length) {
    return <p style={{ color: '#868e96', fontSize: '0.875rem' }}>No participants yet.</p>;
  }
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {participants.map((p) => {
        const hasVote = p.vote !== null;
        const label = revealed
          ? (p.vote ?? '—')
          : hasVote ? 'Voted' : 'Waiting';
        return (
          <li key={p.id} style={row}>
            <span style={{ fontWeight: 500 }}>{p.name}</span>
            <span style={badge(hasVote, revealed, p.vote)}>{label}</span>
          </li>
        );
      })}
    </ul>
  );
}

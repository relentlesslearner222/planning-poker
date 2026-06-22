import React from 'react';
import './Results.css';

function calcStats(participants) {
  const numeric = participants
    .map((p) => Number(p.vote))
    .filter((v) => !isNaN(v));
  if (!numeric.length) return null;
  const avg = (numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(1);
  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  const sorted = [...numeric].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0
    ? sorted[mid]
    : ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1);
  return { avg, min, max, median };
}

export default function Results({ participants }) {
  const stats = calcStats(participants);

  return (
    <div className="results">
      <h3>Results</h3>
      {stats && (
        <div className="stats">
          <div className="stat"><label>Avg</label><span>{stats.avg}</span></div>
          <div className="stat"><label>Median</label><span>{stats.median}</span></div>
          <div className="stat"><label>Min</label><span>{stats.min}</span></div>
          <div className="stat"><label>Max</label><span>{stats.max}</span></div>
        </div>
      )}
      <ul className="vote-list">
        {participants.map((p) => (
          <li key={p.id}>
            <span className="p-name">{p.name}</span>
            <span className="p-vote">{p.vote != null ? p.vote : '--'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

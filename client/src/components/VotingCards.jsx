import React from 'react';
import './VotingCards.css';

const CARD_VALUES = ['0', '1', '2', '3', '5', '8', '13', '21', '40', '80', '?'];

export default function VotingCards({ selectedVote, onVote, disabled }) {
  return (
    <div className="cards-grid">
      {CARD_VALUES.map((v) => (
        <button
          key={v}
          className={`p-card${selectedVote === v ? ' selected' : ''}${disabled ? ' disabled' : ''}`}
          onClick={() => !disabled && onVote(v)}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

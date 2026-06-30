import React from 'react';

const FIBONACCI = ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'];

const cardBase = {
  width: '56px',
  height: '80px',
  borderRadius: '8px',
  border: '2px solid #ced4da',
  background: '#fff',
  fontSize: '1.1rem',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'transform 0.15s, border-color 0.15s, background 0.15s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none'
};

export default function FibonacciDeck({ onVote, selectedValue, disabled }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
      {FIBONACCI.map((val) => {
        const isSelected = selectedValue === val;
        return (
          <button
            key={val}
            onClick={() => !disabled && onVote(val)}
            disabled={disabled}
            aria-pressed={isSelected}
            style={{
              ...cardBase,
              borderColor: isSelected ? '#428ca8' : '#ced4da',
              background: isSelected ? '#e8f4f8' : '#fff',
              color: isSelected ? '#428ca8' : '#343a40',
              transform: isSelected ? 'translateY(-4px)' : 'none',
              opacity: disabled ? 0.6 : 1
            }}
          >
            {val}
          </button>
        );
      })}
    </div>
  );
}

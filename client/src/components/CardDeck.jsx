const CARDS = ['1', '2', '3', '5', '8', '13', '21', '?', '☕'];

export default function CardDeck({ socket, myVote, onVote, disabled }) {
  function handleSelect(value) {
    if (disabled) return;
    onVote(value);
  }

  return (
    <div className="flex flex-wrap gap-3 justify-center">
      {CARDS.map((card) => {
        const isSelected = myVote === card;
        return (
          <button
            key={card}
            onClick={() => handleSelect(card)}
            disabled={disabled}
            aria-label={`Vote ${card}`}
            aria-pressed={isSelected}
            className={[
              'w-16 h-24 rounded-xl border-2 text-xl font-bold transition-all duration-150 select-none',
              'flex items-center justify-center shadow-sm',
              disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer hover:shadow-md hover:-translate-y-1 active:scale-95',
              isSelected
                ? 'border-brand-primary bg-brand-primary text-white shadow-md -translate-y-2 scale-105'
                : 'border-gray-300 bg-white text-gray-700 hover:border-brand-primary',
            ].join(' ')}
          >
            {card}
          </button>
        );
      })}
    </div>
  );
}

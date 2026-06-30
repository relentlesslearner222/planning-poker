import React from 'react';
import { render, screen } from '@testing-library/react';
import ParticipantList from '../ParticipantList';

const participants = [
  { id: 's1', name: 'Alice', vote: '5' },
  { id: 's2', name: 'Bob', vote: null }
];

describe('ParticipantList', () => {
  it('shows Voted/Waiting badges when not revealed', () => {
    render(<ParticipantList participants={participants} revealed={false} />);
    expect(screen.getByText('Voted')).toBeInTheDocument();
    expect(screen.getByText('Waiting')).toBeInTheDocument();
  });

  it('shows actual vote values when revealed', () => {
    render(<ParticipantList participants={participants} revealed={true} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders empty state message', () => {
    render(<ParticipantList participants={[]} revealed={false} />);
    expect(screen.getByText(/No participants/i)).toBeInTheDocument();
  });
});

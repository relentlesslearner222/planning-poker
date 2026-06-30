import React from 'react';
import { render, screen } from '@testing-library/react';
import TimerDisplay from '../TimerDisplay';

describe('TimerDisplay', () => {
  it('renders null when timerSync is falsy', () => {
    const { container } = render(<TimerDisplay timerSync={null} isHost={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays MM:SS formatted time', () => {
    render(<TimerDisplay timerSync={{ remaining: 65000, running: true, totalDuration: 120000 }} isHost={false} />);
    expect(screen.getByText('01:05')).toBeInTheDocument();
  });

  it('shows 00:00 when remaining is 0', () => {
    render(<TimerDisplay timerSync={{ remaining: 0, running: false, totalDuration: 60000 }} isHost={false} />);
    expect(screen.getByText('00:00')).toBeInTheDocument();
  });
});

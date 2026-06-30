import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Lobby from '../Lobby';

describe('Lobby', () => {
  it('renders join button disabled when not connected', () => {
    render(<Lobby onJoin={() => {}} connected={false} />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
  });

  it('calls onJoin with roomId and userName on submit', () => {
    const onJoin = jest.fn();
    render(<Lobby onJoin={onJoin} connected={true} />);
    fireEvent.change(screen.getByPlaceholderText(/Alice/i), { target: { value: 'TestUser' } });
    fireEvent.change(screen.getByPlaceholderText(/sprint-42/i), { target: { value: 'room99' } });
    fireEvent.click(screen.getByRole('button'));
    expect(onJoin).toHaveBeenCalledWith('room99', 'TestUser');
  });

  it('generates a random roomId when none provided', () => {
    const onJoin = jest.fn();
    render(<Lobby onJoin={onJoin} connected={true} />);
    fireEvent.change(screen.getByPlaceholderText(/Alice/i), { target: { value: 'TestUser' } });
    fireEvent.click(screen.getByRole('button'));
    const [calledRoomId] = onJoin.mock.calls[0];
    expect(calledRoomId).toBeTruthy();
    expect(calledRoomId.length).toBeGreaterThan(0);
  });
});

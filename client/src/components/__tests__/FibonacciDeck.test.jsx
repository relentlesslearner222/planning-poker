import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FibonacciDeck from '../FibonacciDeck';

describe('FibonacciDeck', () => {
  it('renders all Fibonacci cards', () => {
    render(<FibonacciDeck onVote={() => {}} selectedValue={null} disabled={false} />);
    ['0', '1', '2', '3', '5', '8', '13', '21', '?'].forEach((val) => {
      expect(screen.getByText(val)).toBeInTheDocument();
    });
  });

  it('calls onVote with correct value when card clicked', () => {
    const onVote = jest.fn();
    render(<FibonacciDeck onVote={onVote} selectedValue={null} disabled={false} />);
    fireEvent.click(screen.getByText('5'));
    expect(onVote).toHaveBeenCalledWith('5');
  });

  it('does not call onVote when disabled', () => {
    const onVote = jest.fn();
    render(<FibonacciDeck onVote={onVote} selectedValue={null} disabled={true} />);
    fireEvent.click(screen.getByText('8'));
    expect(onVote).not.toHaveBeenCalled();
  });

  it('marks selected card with aria-pressed', () => {
    render(<FibonacciDeck onVote={() => {}} selectedValue="3" disabled={false} />);
    const card = screen.getByText('3').closest('button');
    expect(card).toHaveAttribute('aria-pressed', 'true');
  });
});

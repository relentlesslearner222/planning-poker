import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';
const VOTE_CARDS = [1, 2, 3, 5, 8, 13];

let socket;

export default function App() {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);
  const [roomState, setRoomState] = useState({ participants: [], revealed: false });
  const [myVote, setMyVote] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    socket = io(SOCKET_URL);
    socket.on('roomUpdate', (state) => setRoomState(state));
    return () => socket.disconnect();
  }, []);

  const handleJoin = (e) => {
    e.preventDefault();
    if (!name.trim() || !roomId.trim()) return;
    socket.emit('joinRoom', { roomId, name }, (res) => {
      if (res.error) { setError(res.error); return; }
      setJoined(true);
    });
  };

  const submitVote = (card) => {
    setMyVote(card);
    socket.emit('submitVote', { vote: card });
  };

  const revealVotes = () => socket.emit('revealVotes');
  const resetVotes = () => { setMyVote(null); socket.emit('resetVotes'); };

  if (!joined) {
    return (
      React.createElement('div', {'>
        React.createElement('h1', null, 'Planning Poker'),
        React.createElement('form', { onSubmit: handleJoin },
          React.createElement('input', {
            placeholder: 'Your name', value: name, onChange: (e) => setName(e.target.value), required: true
          }),
          React.createElement('input', {
            placeholder: 'Room ID', value: roomId, onChange: (e) => setRoomId(e.target.value), required: true
          }),
          React.createElement('button', { type: 'submit' }, 'Join Room')
        ),
        error && React.createElement('p', { style: { color: 'red' } }, error)
      )
    );
  }

  return (
    React.createElement('div', null,
      React.createElement('h1', null, 'Planning Poker - Room: ' + roomId),
      React.createElement('section', null,
        React.createElement('h2', null, 'Cast Your Vote'),
        React.createElement('div', null,
          VOTE_CARDS.map((card) =>
            React.createElement('button', {
              key: card,
              onClick: () => submitVote(card),
              style: {
                margin: '4px', padding: '1rem 1.5rem', fontSize: '1.25rem',
                cursor: 'pointer',
                background: myVote === card ? '#333' : '#fff',
                color: myVote === card ? '#fff' : '#333',
                border: '2px solid #333', borderRadius: '8px'
              }
            }, card)
          )
        )
      ),
      React.createElement('section', null,
        React.createElement('h2', null, 'Participants'),
        React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse' } },
          React.createElement('thead', null,
            React.createElement('tr', null,
              React.createElement('th', null, 'Name'),
              React.createElement('th', null, 'Vote')
            )
          ),
          React.createElement('tbody', null,
            roomState.participants.map((p) =>
              React.createElement('tr', { key: p.id },
                React.createElement('td', null, p.name),
                React.createElement('td', null, p.vote !== null ? p.vote : '--')
              )
            )
          )
        )
      ),
      React.createElement('div', { style: { marginTop: '2rem' } },
        !roomState.revealed && React.createElement('button', { onClick: revealVotes, style: { marginRight: '1rem' } }, 'Reveal Votes'),
        React.createElement('button', { onClick: resetVotes }, 'Reset Round')
      )
    )
  );
}

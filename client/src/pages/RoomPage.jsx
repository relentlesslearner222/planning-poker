import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocketContext } from '../context/SocketContext.jsx';
import JoinForm from '../components/JoinForm.jsx';
import InviteBar from '../components/InviteBar.jsx';
import CardDeck from '../components/CardDeck.jsx';
import ParticipantsPanel from '../components/ParticipantsPanel.jsx';
import TimerDisplay from '../components/TimerDisplay.jsx';
import TimerControls from '../components/TimerControls.jsx';
import ResultsView from '../components/ResultsView.jsx';

export default function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const {
    socket,
    mySocketId,
    roomState,
    timerSync,
    revealedVotes,
    isHost,
    isTimerActive,
  } = useSocketContext();

  const [joined, setJoined] = useState(false);
  const [myVote, setMyVote] = useState(null);

  // Detect when we appear in participants list → joined
  useEffect(() => {
    if (roomState && mySocketId) {
      const inRoom = roomState.participants.some((p) => p.socketId === mySocketId);
      if (inRoom) setJoined(true);
    }
  }, [roomState, mySocketId]);

  // Reset myVote on new round
  useEffect(() => {
    if (roomState && !roomState.revealed) {
      setMyVote(null);
    }
  }, [roomState?.revealed]);

  // Handle error — if room doesn't exist, go home
  useEffect(() => {
    if (!socket) return;
    function handleError({ message }) {
      if (message === 'Room not found. Check your invite link.') {
        navigate('/');
      }
    }
    socket.on('room:error', handleError);
    return () => socket.off('room:error', handleError);
  }, [socket, navigate]);

  function handleVote(value) {
    setMyVote(value);
    socket.emit('vote:submit', { value });
  }

  if (!joined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-light to-white px-4">
        <JoinForm roomId={roomId} socket={socket} />
      </div>
    );
  }

  const revealed = roomState?.revealed || false;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🃏</span>
          <h1 className="text-xl font-bold text-gray-800">Planning Poker</h1>
          {isHost && (
            <span className="text-xs bg-brand-primary text-white px-2 py-0.5 rounded-full font-medium">
              Host
            </span>
          )}
        </div>
        <InviteBar roomId={roomId} />
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: participants */}
        <div className="lg:col-span-1">
          <ParticipantsPanel
            participants={roomState?.participants || []}
            votes={roomState?.votes || {}}
            revealedVotes={revealedVotes}
            mySocketId={mySocketId}
            revealed={revealed}
          />
        </div>

        {/* Right column: main game area */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Timer section */}
          {(timerSync && timerSync.totalDuration > 0) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col items-center">
              <TimerDisplay timerSync={timerSync} isHost={isHost} />
            </div>
          )}

          {/* Host timer controls */}
          {isHost && !revealed && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Timer Controls</h3>
              <TimerControls socket={socket} isTimerActive={isTimerActive} />
            </div>
          )}

          {/* Card deck or results */}
          {revealed ? (
            <ResultsView
              revealedVotes={revealedVotes}
              participants={roomState?.participants || []}
              isHost={isHost}
              socket={socket}
            />
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">Pick your card</h2>
              <CardDeck
                socket={socket}
                myVote={myVote}
                onVote={handleVote}
                disabled={revealed}
              />

              {/* Host reveal button */}
              {isHost && (
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => socket.emit('vote:reveal')}
                    className="bg-brand-primary hover:bg-brand-dark text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                  >
                    Reveal Votes
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

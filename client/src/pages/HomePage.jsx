import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocketContext } from '../context/SocketContext.jsx';

export default function HomePage() {
  const { socket, roomState } = useSocketContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket) return;

    function handleRoomCreated({ roomId }) {
      navigate(`/room/${roomId}`);
    }

    socket.on('room:created', handleRoomCreated);
    return () => socket.off('room:created', handleRoomCreated);
  }, [socket, navigate]);

  function handleCreateRoom() {
    if (socket) {
      socket.emit('room:create');
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-brand-light to-white px-4">
      <div className="text-center mb-10">
        <div className="text-6xl mb-4">🃏</div>
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Planning Poker</h1>
        <p className="text-gray-500 text-lg">Estimate stories together, in real time.</p>
      </div>

      <button
        onClick={handleCreateRoom}
        className="bg-brand-primary hover:bg-brand-dark text-white font-semibold text-lg px-8 py-4 rounded-xl shadow-md transition-all duration-200 hover:shadow-lg active:scale-95"
      >
        Create Room
      </button>

      <p className="mt-6 text-sm text-gray-400">
        Share the link with your team — they can join directly.
      </p>
    </div>
  );
}

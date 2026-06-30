import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import Lobby from './components/Lobby';
import PokerRoom from './components/PokerRoom';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || '/';

export default function App() {
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [roomState, setRoomState] = useState(null);
  const [timerSync, setTimerSync] = useState({ remaining: 0, running: false, totalDuration: 0 });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('room:joined', ({ roomId: rid, isHost: host }) => {
      setRoomId(rid);
      setIsHost(host);
    });
    s.on('room:state', (state) => setRoomState(state));
    s.on('timerSync', (sync) => setTimerSync(sync));
    setSocket(s);
    return () => s.disconnect();
  }, []);

  const handleJoin = useCallback((rid, userName) => {
    if (socket) socket.emit('room:join', { roomId: rid, userName });
  }, [socket]);

  const handleLeave = useCallback(() => {
    if (socket) socket.emit('room:leave');
    setRoomId(null);
    setRoomState(null);
    setIsHost(false);
  }, [socket]);

  if (!roomId) {
    return <Lobby onJoin={handleJoin} connected={connected} />;
  }

  return (
    <PokerRoom
      socket={socket}
      roomId={roomId}
      isHost={isHost}
      roomState={roomState}
      timerSync={timerSync}
      onLeave={handleLeave}
    />
  );
}

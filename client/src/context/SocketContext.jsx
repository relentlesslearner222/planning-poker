import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const [mySocketId, setMySocketId] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const [timerSync, setTimerSync] = useState(null);
  const [revealedVotes, setRevealedVotes] = useState(null);

  useEffect(() => {
    const socket = io({ transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setMySocketId(socket.id);
    });

    socket.on('room:state', (state) => {
      setRoomState(state);
      // If a new round reset, clear revealed votes
      if (!state.revealed) {
        setRevealedVotes(null);
      }
    });

    socket.on('vote:updated', ({ votes }) => {
      setRoomState((prev) => (prev ? { ...prev, votes } : prev));
    });

    socket.on('vote:revealed', ({ votes }) => {
      setRevealedVotes(votes);
      setRoomState((prev) => (prev ? { ...prev, revealed: true } : prev));
    });

    socket.on('timer:sync', (sync) => {
      setTimerSync(sync);
    });

    socket.on('room:participant-left', () => {
      // room:state will follow; no extra action needed here
    });

    socket.on('disconnect', () => {
      setMySocketId(null);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const isHost = roomState && mySocketId
    ? roomState.hostSocketId === mySocketId
    : false;

  const isTimerActive = timerSync ? timerSync.running : false;

  const value = {
    socket: socketRef.current,
    mySocketId,
    roomState,
    timerSync,
    revealedVotes,
    isHost,
    isTimerActive,
    setRoomState,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocketContext must be used within SocketProvider');
  return ctx;
}

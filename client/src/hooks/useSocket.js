/* src/hooks/useSocket.js */
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SETREGION_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:4000';

let socketSingleton = null;

export function getSocket() {
  if (!socketSingleton) {
    socketSingleton = io(SETREGION_URL, { transports: ['websocket', 'polling'] });
  }
  return socketSingleton;
}

export function useSocketEvent(event, handler) {
  const savedHandler = useRef(handler);
  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const socket = getSocket();
    const listener = (...args) => savedHandler.current(...args);
    socket.on(event, listener);
    return () => socket.off(event, listener);
  }, [event]);
}

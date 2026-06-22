import React, { useState } from 'react';
import Lobby from './components/Lobby';
import Room from './components/Room';

export default function App() {
  const [session, setSession] = useState(null);

  if (session) {
    return <Room session={session} onLeave={() => setSession(null)} />;
  }
  return <Lobby onJoin={setSession} />;
}

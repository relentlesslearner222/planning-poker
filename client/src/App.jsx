import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext.jsx';
import HomePage from './pages/HomePage.jsx';
import RoomPage from './pages/RoomPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <SocketProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/room/:roomId" element={<RoomPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SocketProvider>
    </BrowserRouter>
  );
}

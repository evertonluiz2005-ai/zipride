import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import MapPage from './pages/MapPage';
import RidePage from './pages/RidePage';
import HistoryPage from './pages/HistoryPage';
import './App.css';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="full-loader"><div className="spinner" /><p>Carregando...</p></div>;
  return user ? children : <Navigate to="/login" />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? '/map' : '/login'} />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/map" element={<PrivateRoute><MapPage /></PrivateRoute>} />
      <Route path="/ride" element={<PrivateRoute><RidePage /></PrivateRoute>} />
      <Route path="/history" element={<PrivateRoute><HistoryPage /></PrivateRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

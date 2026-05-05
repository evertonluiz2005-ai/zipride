import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login           from './pages/Login';
import Register        from './pages/Register';
import CompleteProfile from './pages/CompleteProfile';
import MapPage         from './pages/MapPage';
import RidePage        from './pages/RidePage';
import HistoryPage     from './pages/HistoryPage';
import PaymentPage     from './pages/PaymentPage';
import './App.css';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="full-loader"><div className="spinner" /><p>Carregando...</p></div>;
  return user ? children : <Navigate to="/login" />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/"                 element={<Navigate to={user ? '/map' : '/login'} />} />
      <Route path="/login"            element={<Login />} />
      <Route path="/register"         element={<Register />} />
      <Route path="/complete-profile" element={<PrivateRoute><CompleteProfile /></PrivateRoute>} />
      <Route path="/map"              element={<PrivateRoute><MapPage /></PrivateRoute>} />
      <Route path="/ride"             element={<PrivateRoute><RidePage /></PrivateRoute>} />
      <Route path="/payment"          element={<PrivateRoute><PaymentPage /></PrivateRoute>} />
      <Route path="/history"          element={<PrivateRoute><HistoryPage /></PrivateRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

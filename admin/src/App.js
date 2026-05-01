import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Fleet from './pages/Fleet';
import Rides from './pages/Rides';
import Hubs from './pages/Hubs';
import Zones from './pages/Zones';
import api from './api';
import './App.css';

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@patinete.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await api.login(email, password);
      if (data.user.role !== 'admin') throw new Error('Acesso restrito a administradores');
      localStorage.setItem('admin_token', data.token);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  return (
    <div className="login-screen">
      <div className="login-box">
        <div className="login-logo">⚡ ZipRide <span>Admin</span></div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-msg">{error}</div>}
          <div className="field"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="field"><label>Senha</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
          <button type="submit" className="btn-login" disabled={loading}>{loading ? 'Entrando...' : 'Acessar painel'}</button>
          <div className="hint">Padrão: admin@patinete.com / admin123</div>
        </form>
      </div>
    </div>
  );
}

function Layout({ user, onLogout }) {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-bolt">⚡</span>
          <div>
            <div className="logo-name">ZipRide</div>
            <div className="logo-tag">Admin Panel</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {[
            { to: '/dashboard', icon: '📊', label: 'Dashboard' },
            { to: '/fleet', icon: '🛴', label: 'Frota' },
            { to: '/rides', icon: '🏁', label: 'Corridas' },
            { to: '/hubs', icon: '🅿️', label: 'Hubs' },
            { to: '/zones', icon: '🗺️', label: 'Zonas' },
          ].map(({ to, icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="admin-info">
            <div className="admin-avatar">{user?.name?.[0]}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.name}</div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>Administrador</div>
            </div>
          </div>
          <button className="btn-logout" onClick={onLogout}>Sair</button>
        </div>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/fleet" element={<Fleet />} />
          <Route path="/rides" element={<Rides />} />
          <Route path="/hubs" element={<Hubs />} />
          <Route path="/zones" element={<Zones />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      api.me().then(u => { if (u.role === 'admin') setUser(u); })
        .catch(() => localStorage.removeItem('admin_token'))
        .finally(() => setLoading(false));
    } else { setLoading(false); }
  }, []);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  if (!user) return <Login onLogin={setUser} />;

  return (
    <BrowserRouter>
      <Layout user={user} onLogout={() => { localStorage.removeItem('admin_token'); setUser(null); }} />
    </BrowserRouter>
  );
}

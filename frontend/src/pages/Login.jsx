import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/map');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-logo">
        <span className="logo-icon">⚡</span>
        <h1 className="logo-text">ZipRide</h1>
        <p className="logo-sub">Patinetes Elétricos Campo Mourão</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Entrar</h2>
        {error && <div className="error-msg">{error}</div>}

        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
          />
        </div>
        <div className="field">
          <label>Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            required
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <div className="hint-box">
          <strong>Demo:</strong> joao@teste.com / 123456
        </div>

        <p className="auth-link">
          Não tem conta? <Link to="/register">Criar conta</Link>
        </p>
      </form>
    </div>
  );
}

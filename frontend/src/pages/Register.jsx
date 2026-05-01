import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) {
      return setError('Senha deve ter ao menos 6 caracteres');
    }
    setLoading(true);
    try {
      await register(form.name, form.email, form.phone, form.password);
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
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Criar conta</h2>
        {error && <div className="error-msg">{error}</div>}

        {[
          { key: 'name', label: 'Nome completo', type: 'text', placeholder: 'João Silva' },
          { key: 'email', label: 'Email', type: 'email', placeholder: 'seu@email.com' },
          { key: 'phone', label: 'Telefone (opcional)', type: 'tel', placeholder: '44 9 9999-9999' },
          { key: 'password', label: 'Senha', type: 'password', placeholder: '••••••' },
        ].map(({ key, label, type, placeholder }) => (
          <div className="field" key={key}>
            <label>{label}</label>
            <input
              type={type}
              value={form[key]}
              onChange={(e) => setField(key, e.target.value)}
              placeholder={placeholder}
              required={key !== 'phone'}
            />
          </div>
        ))}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Criando conta...' : 'Criar conta grátis'}
        </button>

        <p className="auth-link">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </form>
    </div>
  );
}

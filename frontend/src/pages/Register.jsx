import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LgpdModal from '../components/LgpdModal';

function maskCPF(value) {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .slice(0, 14);
}

function validateCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let d1 = 11 - (sum % 11); if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  let d2 = 11 - (sum % 11); if (d2 >= 10) d2 = 0;
  return d2 === parseInt(cpf[10]);
}

export default function Register() {
  const [form, setForm]         = useState({ name: '', email: '', phone: '', cpf: '', password: '' });
  const [lgpdAccepted, setLgpd] = useState(false);
  const [showLgpd, setShowLgpd] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: k === 'cpf' ? maskCPF(v) : v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!lgpdAccepted)
      return setError('Você precisa aceitar os Termos de Uso e Privacidade');

    if (form.password.length < 6)
      return setError('Senha deve ter ao menos 6 caracteres');

    if (!validateCPF(form.cpf))
      return setError('CPF inválido — verifique os dígitos');

    setLoading(true);
    try {
      await register(form.name, form.email, form.phone, form.password, form.cpf, true);
      navigate('/map');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      {showLgpd && (
        <LgpdModal
          onAccept={() => { setLgpd(true);  setShowLgpd(false); }}
          onReject={() => { setLgpd(false); setShowLgpd(false); }}
        />
      )}

      <div className="auth-logo">
        <span className="logo-icon">⚡</span>
        <h1 className="logo-text">ZipRide</h1>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button type="button" onClick={() => navigate('/login')}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20, padding: 0, lineHeight: 1 }}>
            ←
          </button>
          <h2 style={{ margin: 0 }}>Criar conta</h2>
        </div>
        {error && <div className="error-msg">{error}</div>}

        <div className="field">
          <label>Nome completo</label>
          <input type="text" value={form.name} onChange={e => setField('name', e.target.value)}
            placeholder="João Silva" required />
        </div>

        <div className="field">
          <label>CPF</label>
          <input
            type="text"
            inputMode="numeric"
            value={form.cpf}
            onChange={e => setField('cpf', e.target.value)}
            placeholder="000.000.000-00"
            required
          />
        </div>

        <div className="field">
          <label>Email</label>
          <input type="email" value={form.email} onChange={e => setField('email', e.target.value)}
            placeholder="seu@email.com" required />
        </div>

        <div className="field">
          <label>Telefone (opcional)</label>
          <input type="tel" value={form.phone} onChange={e => setField('phone', e.target.value)}
            placeholder="44 9 9999-9999" />
        </div>

        <div className="field">
          <label>Senha</label>
          <input type="password" value={form.password} onChange={e => setField('password', e.target.value)}
            placeholder="••••••" required />
        </div>

        <div className="hint-box">
          🔒 Seu CPF é necessário para identificação em caso de sinistro ou furto do patinete.
        </div>

        <label style={styles.checkRow}>
          <input
            type="checkbox"
            checked={lgpdAccepted}
            onChange={e => setLgpd(e.target.checked)}
            style={{ width: 18, height: 18, flexShrink: 0 }}
          />
          <span style={{ fontSize: 13, color: '#ccc', lineHeight: 1.4 }}>
            Li e aceito os{' '}
            <button
              type="button"
              onClick={() => setShowLgpd(true)}
              style={{ background: 'none', border: 'none', color: 'var(--primary, #6C63FF)', cursor: 'pointer', padding: 0, fontSize: 13, textDecoration: 'underline' }}
            >
              Termos de Uso e Política de Privacidade
            </button>
            {' '}(LGPD)
          </span>
        </label>

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

const styles = {
  checkRow: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    cursor: 'pointer', marginBottom: 4,
  },
};

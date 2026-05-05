import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

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

export default function CompleteProfile() {
  const [cpf, setCpf]         = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshUser }       = useAuth();
  const navigate              = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!validateCPF(cpf))
      return setError('CPF inválido — verifique os dígitos');

    setLoading(true);
    try {
      await api.completeProfile(cpf);
      await refreshUser();
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
        <h2>Quase lá!</h2>
        <p style={{ color: '#aaa', fontSize: 14, marginBottom: 16, marginTop: -8 }}>
          Para usar o ZipRide precisamos do seu CPF para identificação em caso de sinistro.
        </p>

        {error && <div className="error-msg">{error}</div>}

        <div className="field">
          <label>CPF</label>
          <input
            type="text"
            inputMode="numeric"
            value={cpf}
            onChange={e => setCpf(maskCPF(e.target.value))}
            placeholder="000.000.000-00"
            required
            autoFocus
          />
        </div>

        <div className="hint-box">
          🔒 Seu CPF nunca é compartilhado com terceiros. Usado somente para identificação (LGPD).
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Salvando...' : 'Continuar'}
        </button>
      </form>
    </div>
  );
}

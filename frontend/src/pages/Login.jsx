import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import LgpdModal from '../components/LgpdModal';

const FB_APP_ID = process.env.REACT_APP_FACEBOOK_APP_ID || '';

function loadFbSdk() {
  return new Promise((resolve) => {
    if (window.FB) return resolve(window.FB);
    window.fbAsyncInit = () => {
      window.FB.init({ appId: FB_APP_ID, cookie: true, xfbml: false, version: 'v19.0' });
      resolve(window.FB);
    };
    if (!document.getElementById('facebook-jssdk')) {
      const s = document.createElement('script');
      s.id = 'facebook-jssdk';
      s.src = 'https://connect.facebook.net/pt_BR/sdk.js';
      document.body.appendChild(s);
    }
  });
}

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showLgpd, setShowLgpd] = useState(false);

  const pendingOAuth = useRef(null);

  const { login, googleLogin, facebookLogin } = useAuth();
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

  const triggerGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const data = await googleLogin(tokenResponse.access_token, true);
        navigate(data.needsCpf ? '/complete-profile' : '/map');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    onError: () => { setError('Erro ao conectar com o Google'); setLoading(false); },
  });

  async function triggerFacebook() {
    setLoading(true);
    try {
      const FB = await loadFbSdk();
      FB.login(async (response) => {
        if (!response.authResponse) { setLoading(false); return; }
        try {
          const data = await facebookLogin(response.authResponse.accessToken, true);
          navigate(data.needsCpf ? '/complete-profile' : '/map');
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      }, { scope: 'public_profile,email' });
    } catch {
      setError('Erro ao carregar o Facebook');
      setLoading(false);
    }
  }

  function handleOAuthClick(provider) {
    setError('');
    pendingOAuth.current = provider;
    setShowLgpd(true);
  }

  function handleLgpdAccept() {
    setShowLgpd(false);
    const provider = pendingOAuth.current;
    pendingOAuth.current = null;
    if (provider === 'google')   triggerGoogle();
    if (provider === 'facebook') triggerFacebook();
  }

  function handleLgpdReject() {
    setShowLgpd(false);
    pendingOAuth.current = null;
  }

  return (
    <div className="auth-screen">
      {showLgpd && <LgpdModal onAccept={handleLgpdAccept} onReject={handleLgpdReject} />}

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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#888', fontSize: 13, margin: '4px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#333' }} />
          <span>ou continue com</span>
          <div style={{ flex: 1, height: 1, background: '#333' }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            style={btnGoogle}
            onClick={() => handleOAuthClick('google')}
            disabled={loading}
          >
            <GoogleIcon /> Google
          </button>
          {FB_APP_ID && (
            <button
              type="button"
              style={btnFacebook}
              onClick={() => handleOAuthClick('facebook')}
              disabled={loading}
            >
              <FacebookIcon /> Facebook
            </button>
          )}
        </div>

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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" style={{ verticalAlign: 'middle', marginRight: 2 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" style={{ verticalAlign: 'middle', marginRight: 2 }}>
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
    </svg>
  );
}

const btnBase = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '11px 0', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  border: 'none',
};
const btnGoogle   = { ...btnBase, background: '#fff', color: '#333', border: '1px solid #ddd' };
const btnFacebook = { ...btnBase, background: '#1877F2', color: '#fff' };

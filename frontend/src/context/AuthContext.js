import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';
import { requestFcmToken, onForegroundMessage } from '../services/firebase';

const AuthContext = createContext(null);

async function registerFcmToken() {
  try {
    const fcmToken = await requestFcmToken();
    if (fcmToken) await api.saveFcmToken(fcmToken);
  } catch {
    // Não crítico — usuário pode ter negado permissão
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('scooter_token');
    if (token) {
      api.me()
        .then((u) => { setUser(u); registerFcmToken(); })
        .catch(() => {
          localStorage.removeItem('scooter_token');
          localStorage.removeItem('scooter_refresh_token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onForegroundMessage((payload) => {
      const { title, body } = payload.notification || {};
      if (title && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/logo192.png' });
      }
    });
    return unsubscribe;
  }, []);

  function storeTokens(data) {
    localStorage.setItem('scooter_token',         data.token);
    localStorage.setItem('scooter_refresh_token', data.refreshToken);
    setUser(data.user);
    registerFcmToken();
  }

  async function login(email, password) {
    const data = await api.login(email, password);
    storeTokens(data);
    return data.user;
  }

  async function register(name, email, phone, password, cpf, lgpdAccepted) {
    const data = await api.register(name, email, phone, password, cpf, lgpdAccepted);
    storeTokens(data);
    return data.user;
  }

  async function googleLogin(accessToken, lgpdAccepted) {
    const data = await api.googleAuth(accessToken, lgpdAccepted);
    storeTokens(data);
    return data; // contém needsCpf
  }

  async function facebookLogin(accessToken, lgpdAccepted) {
    const data = await api.facebookAuth(accessToken, lgpdAccepted);
    storeTokens(data);
    return data; // contém needsCpf
  }

  async function refreshUser() {
    const u = await api.me();
    setUser(u);
    return u;
  }

  async function logout() {
    try {
      const refreshToken = localStorage.getItem('scooter_refresh_token');
      await api.logout(refreshToken);
    } catch { /* ignora erro de rede */ }
    localStorage.removeItem('scooter_token');
    localStorage.removeItem('scooter_refresh_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, googleLogin, facebookLogin, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

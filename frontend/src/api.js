const BASE         = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
export const UPLOADS_BASE = BASE.replace('/api', '');

function getToken()        { return localStorage.getItem('scooter_token'); }
function getRefreshToken() { return localStorage.getItem('scooter_refresh_token'); }

function clearAuth() {
  localStorage.removeItem('scooter_token');
  localStorage.removeItem('scooter_refresh_token');
}

async function tryRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem('scooter_token', data.token);
    return true;
  } catch {
    return false;
  }
}

async function request(path, options = {}, _retry = true) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // Tenta renovar o access token automaticamente ao expirar
  if (res.status === 401 && _retry) {
    const refreshed = await tryRefresh();
    if (refreshed) return request(path, options, false);
    clearAuth();
    window.location.href = '/login';
    throw new Error('Sessão expirada');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro na requisição');
  return data;
}

const api = {
  // Auth
  login:    (email, password) => request('/auth/login',    { method: 'POST', body: { email, password } }),
  register: (name, email, phone, password, cpf, lgpdAccepted) =>
    request('/auth/register', { method: 'POST', body: { name, email, phone, password, cpf, lgpdAccepted } }),
  googleAuth:      (accessToken, lgpdAccepted) => request('/auth/google',           { method: 'POST', body: { accessToken, lgpdAccepted } }),
  facebookAuth:    (accessToken, lgpdAccepted) => request('/auth/facebook',         { method: 'POST', body: { accessToken, lgpdAccepted } }),
  completeProfile: (cpf)                       => request('/auth/complete-profile', { method: 'POST', body: { cpf } }),
  me:       () => request('/auth/me'),
  refresh:  (refreshToken) => request('/auth/refresh', { method: 'POST', body: { refreshToken } }, false),
  logout:   (refreshToken) => request('/auth/logout',  { method: 'POST', body: { refreshToken } }, false),
  saveFcmToken: (fcmToken) => request('/auth/fcm-token', { method: 'POST', body: { fcmToken } }),

  uploadReturnPhoto: async (rideId, file) => {
    const token = getToken();
    const form  = new FormData();
    form.append('photo', file);
    const res = await fetch(`${BASE}/rides/${rideId}/photo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro no upload');
    return data;
  },

  uploadDocument: async (file) => {
    const token = getToken();
    const form  = new FormData();
    form.append('document', file);
    const res = await fetch(`${BASE}/auth/upload-document`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro no upload');
    return data;
  },

  // Map
  getMap: () => request('/map'),

  // Scooters
  getScooters: ()   => request('/scooters'),
  getScooter:  (id) => request(`/scooters/${id}`),

  // Rides
  startRide:    (scooterId) => request('/rides/start',         { method: 'POST', body: { scooterId } }),
  endRide:      (rideId, endTime) => request(`/rides/${rideId}/end`, { method: 'POST', body: endTime ? { endTime } : {} }),
  getActiveRide: ()         => request('/rides/active'),
  getMyRides:   ()          => request('/rides/my'),
  getPricing:   ()          => request('/rides/pricing'),

  // Payments — Stripe Card
  getStripeKey:      ()               => request('/payments/publishable-key'),
  getCard:           ()               => request('/payments/card'),
  createSetupIntent: ()               => request('/payments/setup-intent', { method: 'POST' }),
  saveCard:          (paymentMethodId) => request('/payments/save-card', { method: 'POST', body: { paymentMethodId } }),
  removeCard:        ()               => request('/payments/card',     { method: 'DELETE' }),
  retryPayment:      (rideId)         => request(`/payments/retry/${rideId}`, { method: 'POST' }),

  // Payments — Pix
  createPixPayment: (amount)           => request('/payments/pix', { method: 'POST', body: { amount } }),
  getPixStatus:     (paymentIntentId)  => request(`/payments/pix/${paymentIntentId}/status`),
};

export default api;
